# College AI Assistant 🎓🤖

An intelligent, multi-agent RAG (Retrieval-Augmented Generation) college assistant built with **FastAPI**, **LangGraph**, **Groq (Llama 3.3 / 3.1)**, **HuggingFace Embeddings**, and a modern **Apple-inspired Liquid Frost** frontend.

---

## 🌟 Key Features

- **Multi-Route RAG Architecture**: Routes student queries dynamically to Academic Handbooks, Fee Structures, or General College Advisory.
- **Dynamic Programme Personalization**: Tailored context for **BCA**, **BBA**, and **B.Com (Honours)** students.
- **Two-Step Frosted Onboarding**: Personalize interests (*Academics*, *Fees*, *Courses*, *Examinations*, *General*) before entering the conversation.
- **Unified Liquid Frost UI**: Translucent glassmorphism, responsive centered conversation container, and dedicated bottom clearance to prevent composer overlap.
- **Markdown Tables & Source Badges**: Renders fees and course credit schedules in structured tables with citations.

---

## 🛠 Tech Stack

- **Backend**: FastAPI, Uvicorn, LangGraph, LangChain, FAISS, HuggingFace BGE Embeddings, Groq LLM API.
- **Frontend**: Vanilla HTML5, Modern CSS (Glassmorphism & Liquid Frost Tokens), JavaScript (Fetch API, Markdown Parser).

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/yoloaryan/Chatbot_Langgraph.git
cd Chatbot_Langgraph
```

### 2. Set up Python Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory:
```env
GROQ_API_KEY=your_groq_api_key_here
```

### 5. Start the Application
```bash
uvicorn main:app --reload --port 8900
```

Open your browser and navigate to:
```
http://127.0.0.1:8900/
```

---

## 📁 Project Structure

```
├── main.py                     # FastAPI server, LangGraph workflow, FAISS RAG logic
├── requirements.txt            # Python dependencies
├── academics_handbook.pdf      # College academic handbook source document
├── fee_structure.pdf           # College fee structure source document
├── .env.example                # Example environment variables
├── frontend/
│   ├── index.html              # Chatbot UI & Two-Step Onboarding Modal
│   ├── style.css               # Liquid Frost styling & responsive alignment
│   └── script.js               # State handling, API fetch, Markdown parser
└── README.md
```