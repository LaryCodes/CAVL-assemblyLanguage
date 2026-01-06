# CAVL - Computer Architecture Visual Lab

CAVL (Computer Architecture Visual Lab) is a web-based application designed for executing and visualizing MIPS assembly code. It provides a user-friendly interface to write, run, and step through MIPS code, with a visual representation of memory and registers.

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python 3.12+
- **MIPS Simulation**: [MARS (MIPS Assembler and Runtime Simulator)](http://courses.missouristate.edu/kenvollmar/mars/)

## Project Structure

The project is organized into three main directories:

- `frontend/`: Contains the Next.js frontend application.
- `backend/`: Contains the FastAPI backend server that communicates with the MIPS simulator.
- `mips/`: Contains core MIPS assembly files used by the application, such as the heap allocator.
- `examples/`: Contains example `.asm` files.

## Getting Started

### Prerequisites

- Node.js (v20 or later recommended)
- Python (3.12 or later)
- `uv` Python package manager (`pip install uv`)
- Java Runtime Environment (for running `mars.jar`)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd CAVL
    ```

2.  **Set up the backend:**
    ```bash
    cd backend
    uv venv  # Create a virtual environment
    source .venv/bin/activate  # Or `.\.venv\Scripts\activate.ps1` on PowerShell
    uv sync # Install dependencies
    cd ..
    ```

3.  **Set up the frontend:**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

### Running the Application

1.  **Start the backend server:**
    Open a terminal in the `backend/` directory and run:
    ```bash
    uvicorn app.main:app --reload
    ```
    The backend will be running at `http://127.0.0.1:8000`.

2.  **Start the frontend development server:**
    Open a second terminal in the `frontend/` directory and run:
    ```bash
    npm run dev
    ```
    The frontend will be available at `http://localhost:3000`.

Now you can open `http://localhost:3000` in your browser to use the application.
