import os
from typing import Annotated, TypedDict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from langchain_groq import ChatGroq
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, START, END

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

if not os.getenv("GROQ_API_KEY"):
    raise RuntimeError("GROQ_API_KEY is not configured.")

# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(title="College AI Assistant API", version="1.0.0")

# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# EMBEDDINGS
# ============================================================

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2")

# ============================================================
# BUILD RETRIEVER
# ============================================================


def build_retriever(pdf_path: str):

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    loader = PyPDFLoader(pdf_path)

    documents = loader.load()

    splitter = RecursiveCharacterTextSplitter(chunk_size=800,
                                              chunk_overlap=100)

    chunks = splitter.split_documents(documents)

    vectorstore = FAISS.from_documents(chunks, embedding=embeddings)

    return vectorstore.as_retriever(search_kwargs={"k": 4})


# ============================================================
# PDF RETRIEVERS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

ACADEMIC_PDF = os.path.join(BASE_DIR, "academics_handbook.pdf")

FEE_PDF = os.path.join(BASE_DIR, "fee_structure.pdf")

print("Loading academic handbook...")

academic_retriever = build_retriever(ACADEMIC_PDF)

print("Loading fee structure...")

fee_retriever = build_retriever(FEE_PDF)

print("Retrievers loaded successfully.")

# ============================================================
# LLM
# ============================================================

llm = ChatGroq(model="openai/gpt-oss-120b", temperature=0.4)

# ============================================================
# STATE
# ============================================================


class State(TypedDict):

    programme: str

    messages: Annotated[list, add_messages]

    query_type: str

    retrieved_context: str

    source: str


# ============================================================
# API REQUEST MODEL
# ============================================================


class ChatRequest(BaseModel):

    programme: str

    message: str


# ============================================================
# CLASSIFIER NODE
# ============================================================


def classifier_node(state: State) -> dict:

    last_message = state["messages"][-1].content

    prompt = f"""
Classify the following student query into exactly one category:

academic
fee
general

Use "academic" for questions about:

- attendance
- exams
- grading
- credits
- promotion
- course structure
- summer training
- degree requirements
- subjects
- academic regulations

Use "fee" for questions about:

- tuition
- payment
- refund
- late charges
- scholarships
- fees
- money-related topics

Use "general" for:

- greetings
- casual conversation
- unrelated questions
- anything not related to college academic rules or fees

Student query:

{last_message}

Return ONLY one word.
"""

    response = llm.invoke(prompt)

    category = response.content.strip().lower()

    if "academic" in category:
        category = "academic"

    elif "fee" in category:
        category = "fee"

    else:
        category = "general"

    return {"query_type": category}


# ============================================================
# ACADEMIC RAG
# ============================================================


def academic_rag_node(state: State) -> dict:

    query = state["messages"][-1].content

    docs = academic_retriever.invoke(query)

    context = "\n\n".join(doc.page_content for doc in docs)

    return {"retrieved_context": context, "source": "Academic Handbook"}


# ============================================================
# FEE RAG
# ============================================================


def fee_rag_node(state: State) -> dict:

    query = state["messages"][-1].content

    docs = fee_retriever.invoke(query)

    context = "\n\n".join(doc.page_content for doc in docs)

    return {"retrieved_context": context, "source": "Fee Structure"}


# ============================================================
# GENERAL NODE
# ============================================================


def general_node(state: State) -> dict:

    return {
        "retrieved_context": "NO_RETRIEVAL_NEEDED",
        "source": "General Knowledge"
    }


# ============================================================
# RESPONSE NODE
# ============================================================


def response_node(state: State) -> dict:

    query = state["messages"][-1].content

    programme = state.get("programme", "Unknown")

    context = state.get("retrieved_context", "")

    if context == "NO_RETRIEVAL_NEEDED":

        prompt = f"""
You are a friendly College AI Assistant.

The student is enrolled in:

{programme}

Answer the following question naturally and helpfully.

Question:

{query}

Keep the answer concise and useful.

If the question requires official college-specific rules,
tell the student that they should refer to the official
college documents rather than inventing information.
"""

    else:

        prompt = f"""
You are a College AI Assistant helping a student.

Student programme:

{programme}

Use ONLY the provided college document context
for college-specific factual claims.

If the context does not contain enough information,
clearly say that the available document does not provide
enough information.

Do NOT invent rules, fees, percentages, deadlines,
requirements, or policies.

If the context contains information for multiple programmes,
identify the information relevant to:

{programme}

College document context:

-------------------------
{context}
-------------------------

Student question:

{query}

Provide a clear, friendly and precise answer.

Use bullet points when useful.
"""

    response = llm.invoke(prompt)

    return {"messages": [("ai", response.content.strip())]}


# ============================================================
# ROUTER
# ============================================================


def route_query(state: State):

    query_type = state["query_type"]

    if query_type == "academic":
        return "academic_rag"

    if query_type == "fee":
        return "fee_rag"

    return "general"


# ============================================================
# BUILD LANGGRAPH
# ============================================================

graph = StateGraph(State)

graph.add_node("classifier", classifier_node)

graph.add_node("academic_rag", academic_rag_node)

graph.add_node("fee_rag", fee_rag_node)

graph.add_node("general", general_node)

graph.add_node("response", response_node)

# ============================================================
# EDGES
# ============================================================

graph.add_edge(START, "classifier")

graph.add_conditional_edges("classifier", route_query)

graph.add_edge("academic_rag", "response")

graph.add_edge("fee_rag", "response")

graph.add_edge("general", "response")

graph.add_edge("response", END)

# ============================================================
# COMPILE
# ============================================================

chat_app = graph.compile()

# ============================================================
# CHAT API
# ============================================================


@app.post("/chat")
async def chat(request: ChatRequest):

    try:

        if not request.message.strip():

            return {
                "response": "Please enter a question.",
                "category": "general",
                "source": "General"
            }

        result = chat_app.invoke({
            "programme": request.programme,
            "messages": [("human", request.message)]
        })

        answer = result["messages"][-1].content

        category = result.get("query_type", "general")

        source = result.get("source", "General")

        return {"response": answer, "category": category, "source": source}

    except Exception as e:

        print("CHAT ERROR:", e)

        return {
            "response": ("Sorry, something went wrong while "
                         "processing your question."),
            "category":
            "error",
            "source":
            "System"
        }


# ============================================================
# HEALTH CHECK
# ============================================================


@app.get("/health")
async def health():

    return {"status": "healthy", "service": "College AI Assistant"}


# ============================================================
# FRONTEND STATIC FILES
# ============================================================

FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
