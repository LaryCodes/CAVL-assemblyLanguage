# CAVL - Computer Architecture Visual Lab

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)

> An interactive web-based platform for learning MIPS assembly and Computer Organization concepts through real-time visualization.

---

## 🎯 Overview

**CAVL** is an educational tool designed to help students understand Computer Architecture concepts by providing instant visual feedback on MIPS assembly code execution. Unlike traditional simulators, CAVL implements core analysis logic **in MIPS assembly itself**, demonstrating self-referential architecture capabilities.

### Key Features

- 🖥️ **Interactive Code Editor** - Monaco editor with MIPS syntax highlighting
- 📊 **Real-time Visualization** - See registers, memory, and pipeline in action
- 🔍 **Instruction Decoder** - Binary breakdown with color-coded fields
- ⚡ **Pipeline Simulator** - 5-stage pipeline with hazard detection
- 🧠 **MIPS-Centric Design** - Analysis performed by MIPS code, not Python
- 📚 **5 Example Programs** - From Hello World to heap allocators
- 🎨 **Modern UI** - Dark glassmorphism design with smooth animations

---

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:

- **Node.js** v20 or later ([Download](https://nodejs.org/))
- **Python** 3.12 or later ([Download](https://www.python.org/downloads/))
- **Java Runtime** (JRE 8+) for MARS simulator ([Download](https://www.java.com/))
- **uv** package manager: `pip install uv`

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/larycodes/CAVL.git
   cd CAVL
   ```

2. **Backend Setup**
   ```bash
   cd backend
   uv venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   uv sync
   cd ..
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### Running CAVL

**Terminal 1 - Backend:**
```bash
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uvicorn app.main:app --reload
```
Backend runs at `http://localhost:8000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs at `http://localhost:3000`

**Open your browser** to `http://localhost:3000` and start coding!

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [User Guide](docs/USER_GUIDE.md) | Complete guide to using CAVL |
| [Architecture](docs/ARCHITECTURE.md) | System design and technical details |

---

## 🎓 Features in Detail

### 1. Interactive Code Editor

- **Monaco Editor** - Same engine as VS Code
- **Syntax Highlighting** - MIPS-specific color coding
- **5 Example Programs** - Load with one click
- **Floating Controls** - Execute button with spinner animation

### 2. Register Visualization

- **32 MIPS Registers** - Complete register file display
- **Change Highlighting** - Modified registers glow with indigo border
- **HEX/DEC Toggle** - Switch between number formats
- **Register Categories** - Special, return, arguments, temporaries, saved

### 3. Instruction Decoder

- **Real-time Decoding** - Type instruction, see binary instantly
- **Color-Coded Fields** - Each field has unique color
- **Hover Tooltips** - Detailed descriptions on hover
- **Copy Buttons** - Copy hex/decimal with one click
- **6 Quick Examples** - R-type, I-type, J-type samples

### 4. Pipeline Visualizer

- **5-Stage Pipeline** - IF → ID → EX → MEM → WB
- **Hazard Detection** - RAW, load-use, control hazards
- **Data Forwarding** - Toggle forwarding on/off
- **Performance Metrics** - CPI, efficiency, speedup, stalls
- **Visual Alerts** - Yellow warning box for hazards

### 5. MIPS Core Files

**All analysis logic implemented in MIPS assembly:**

- **`instruction_analyzer.asm`** - Classifies instructions into 8 categories
- **`heap_operations.asm`** - First-Fit malloc/free implementation
- **`pipeline_simulator.asm`** - 5-stage pipeline with hazard detection

---

## 🏗️ Project Structure

```
CAVL/
├── frontend/                    # Next.js React application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main page with vertical tabs
│   │   │   └── visual/         # Visual Lab (separate page)
│   │   ├── components/
│   │   │   ├── WelcomeScreen.tsx
│   │   │   ├── VerticalTabMenu.tsx
│   │   │   ├── CodeEditor.tsx
│   │   │   ├── RegisterDisplay.tsx
│   │   │   ├── InstructionDecoder.tsx
│   │   │   ├── PipelineVisualizer.tsx
│   │   │   └── [20+ more components]
│   │   └── lib/
│   │       ├── api.ts          # API client
│   │       └── types.ts        # TypeScript interfaces
│   └── package.json
│
├── backend/                     # FastAPI Python server
│   ├── app/
│   │   ├── main.py             # FastAPI entry point
│   │   ├── routers/            # API endpoints
│   │   │   ├── execution.py
│   │   │   ├── heap.py
│   │   │   ├── decoder.py
│   │   │   └── pipeline.py
│   │   ├── services/           # Business logic
│   │   │   ├── mars_executor.py
│   │   │   ├── trace_parser.py
│   │   │   ├── mips_analyzer.py
│   │   │   ├── pipeline_simulator.py
│   │   │   └── [7 more services]
│   │   └── models/
│   │       └── schemas.py      # Pydantic models
│   ├── tests/                  # Pytest + Hypothesis tests
│   ├── mars.jar                # MARS simulator
│   └── pyproject.toml
│
├── mips/                        # Core MIPS assembly files
│   └── core/
│       ├── instruction_analyzer.asm    # ✅ Active in frontend
│       ├── heap_operations.asm         # ⚠️ Backend only
│       └── pipeline_simulator.asm      # ✅ Active in frontend
│
├── examples/                    # Example MIPS programs
│   ├── heap_allocator.asm
│   ├── memory_layout.asm
│   ├── step_demo.asm
│   └── test.asm
│
├── docs/                        # Documentation
│   ├── USER_GUIDE.md
│   └── ARCHITECTURE.md
│
├── PROJECT_REPORT.md            # Academic project report
└── README.md                    # This file
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 16.1.1 with Turbopack
- **Language:** TypeScript
- **UI Library:** React 19
- **Styling:** Tailwind CSS
- **Editor:** Monaco Editor (VS Code engine)
- **Animation:** Framer Motion
- **Icons:** Lucide React
- **Design:** Dark glassmorphism with 3D effects

### Backend
- **Framework:** FastAPI
- **Language:** Python 3.12+
- **Validation:** Pydantic
- **Testing:** Pytest + Hypothesis (property-based)
- **MIPS Simulator:** MARS (Java)

### Communication
- **Protocol:** HTTP REST API
- **Format:** JSON
- **CORS:** Enabled for localhost:3000

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest                    # Run all tests
pytest -v                 # Verbose output
pytest tests/test_api_routes.py  # Specific file
```

**Test Coverage:**
- API endpoint contracts
- MARS executor integration
- Trace parser correctness
- State manager invariants
- Heap allocator logic

### Frontend Tests
```bash
cd frontend
npm test                  # Run all tests
npm test -- --watch       # Watch mode
```

**Test Coverage:**
- Component rendering
- API client functions
- Type conversions (hex/dec)
- Memory segment ordering

---

## 📚 Example Programs

### 1. Hello World
Basic syscall demonstration with string printing.

### 2. Arithmetic Demo
Simple register operations (add, li) with result display.

### 3. Heap Allocator (First-Fit)
Complete malloc/free implementation in MIPS (400+ lines condensed).

### 4. Memory Layout
Demonstrates all 4 memory segments: TEXT, DATA, HEAP, STACK.

### 5. Step-by-Step Demo
8 sections covering all instruction types (300+ lines condensed).

---

## 🎯 Use Cases

### For Students
- Learn MIPS assembly interactively
- Visualize register and memory changes
- Understand pipeline hazards and forwarding
- Debug assembly code with visual feedback

### For Educators
- Demonstrate Computer Architecture concepts
- Show real-time instruction execution
- Explain memory layout and heap allocation
- Teach pipeline optimization techniques

### For Researchers
- Experiment with MIPS code
- Analyze instruction patterns
- Study memory allocation strategies
- Benchmark pipeline performance

---

## 🔧 Configuration

### Backend Configuration

**Environment Variables** (optional):
```bash
# backend/.env
MARS_JAR_PATH=./mars.jar
EXECUTION_TIMEOUT=5
MAX_MEMORY_DUMP_SIZE=1048576
```

### Frontend Configuration

**Environment Variables** (optional):
```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🐛 Troubleshooting

### Backend won't start

**Issue:** `FileNotFoundError: mars.jar not found`
- **Solution:** Ensure `mars.jar` is in the `backend/` directory

**Issue:** `Java not found`
- **Solution:** Install Java Runtime Environment (JRE 8+)

**Issue:** `Port 8000 already in use`
- **Solution:** Kill the process or use a different port:
  ```bash
  uvicorn app.main:app --reload --port 8001
  ```

### Frontend won't start

**Issue:** `Module not found`
- **Solution:** Run `npm install` in the `frontend/` directory

**Issue:** `Port 3000 already in use`
- **Solution:** Kill the process or Next.js will prompt for port 3001

### Execution errors

**Issue:** `Execution timeout (>5s)`
- **Solution:** Check for infinite loops in your MIPS code

**Issue:** `Syntax error at line X`
- **Solution:** Fix the MIPS syntax error indicated

**Issue:** `Connection error: Is the backend running?`
- **Solution:** Start the backend server first

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   cd backend && pytest
   cd frontend && npm test
   ```
5. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Keep commits atomic and descriptive

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[MARS Simulator](http://courses.missouristate.edu/kenvollmar/mars/)** - Missouri State University
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** - Microsoft
- **[FastAPI](https://fastapi.tiangolo.com/)** - Sebastián Ramírez
- **[Next.js](https://nextjs.org/)** - Vercel
- **[Tailwind CSS](https://tailwindcss.com/)** - Tailwind Labs

---

## 📞 Contact

- **Project Repository:** [github.com/yourusername/CAVL](https://github.com/yourusername/CAVL)
- **Issues:** [github.com/yourusername/CAVL/issues](https://github.com/yourusername/CAVL/issues)
- **Documentation:** [docs/](docs/)

---

## 🗺️ Roadmap

### Current Version (v1.0)
- ✅ Code execution with MARS
- ✅ Register visualization
- ✅ Instruction decoder
- ✅ Pipeline simulator
- ✅ 5 example programs

### Future Enhancements
- 🔲 Heap visualizer frontend integration
- 🔲 Step-by-step execution with backward navigation
- 🔲 Memory layout visualization
- 🔲 Cache simulator (L1/L2)
- 🔲 Interactive tutorials
- 🔲 Code sharing and collaboration
- 🔲 Multi-user support

---

<div align="center">

**Made with ❤️ for Computer Architecture students**

[⬆ Back to Top](#cavl---computer-architecture-visual-lab)

</div>
