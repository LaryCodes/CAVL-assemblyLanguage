# CAVL Architecture Documentation

Technical architecture and design decisions for Computer Architecture Visual Lab.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16.1.1)                │
│  - React with TypeScript                                    │
│  - Monaco Editor (code editing)                             │
│  - Framer Motion (animations)                               │
│  - Vertical tab menu with glassmorphism                     │
│                         ↕ HTTP/JSON                         │
└─────────────────────────────────────────────────────────────┘
                          ↕ REST API
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI/Python)                 │
│  - API routers (execute, decode, pipeline, heap)            │
│  - Services (MARS executor, parsers, analyzers)             │
│                         ↕ Subprocess                        │
└─────────────────────────────────────────────────────────────┘
                          ↕ java -jar
┌─────────────────────────────────────────────────────────────┐
│                    MARS Simulator (Java)                    │
│  - Assembles and executes MIPS code                         │
│  - Dumps registers and memory                               │
│                         ↕ Includes                          │
└─────────────────────────────────────────────────────────────┘
                          ↕ Injected
┌─────────────────────────────────────────────────────────────┐
│                    MIPS Core Files (Assembly)               │
│  - instruction_analyzer.asm (classifies instructions)       │
│  - heap_operations.asm (malloc/free)                        │
│  - pipeline_simulator.asm (5-stage pipeline)                │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
CAVL/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Main page with tab routing
│   │   │   └── visual/page.tsx       # Visual Lab (separate page)
│   │   ├── components/
│   │   │   ├── WelcomeScreen.tsx     # Landing page
│   │   │   ├── VerticalTabMenu.tsx   # Tab navigation
│   │   │   ├── CodeEditor.tsx        # Monaco wrapper
│   │   │   ├── RegisterDisplay.tsx   # 32 registers
│   │   │   ├── InstructionDecoder.tsx # Binary decoder
│   │   │   ├── PipelineVisualizer.tsx # Pipeline simulator
│   │   │   └── Toast.tsx             # Notifications
│   │   └── lib/
│   │       ├── api.ts                # API client
│   │       └── types.ts              # TypeScript interfaces
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI entry
│   │   ├── routers/
│   │   │   ├── execution.py          # /api/execute
│   │   │   ├── decoder.py            # /api/decode/*
│   │   │   ├── pipeline.py           # /api/pipeline/*
│   │   │   └── heap.py               # /api/heap/*
│   │   ├── services/
│   │   │   ├── mars_executor.py      # MARS subprocess
│   │   │   ├── trace_parser.py       # Parse MARS output
│   │   │   ├── mips_analyzer.py      # Instruction analysis
│   │   │   ├── instruction_decoder.py # Binary encoding
│   │   │   ├── pipeline_simulator.py # Pipeline logic
│   │   │   ├── asm_injector.py       # Template injection
│   │   │   └── output_parser.py      # Memory dump parser
│   │   └── models/schemas.py         # Pydantic models
│   ├── tests/                        # Hypothesis tests
│   ├── mars.jar                      # MARS simulator
│   └── pyproject.toml
│
├── mips/core/
│   ├── instruction_analyzer.asm      # Classifies instructions
│   ├── heap_operations.asm           # First-Fit allocator
│   └── pipeline_simulator.asm        # 5-stage pipeline
│
├── examples/                         # Example MIPS programs
└── docs/                             # Documentation
```

---

## Key Design Decisions

### 1. MIPS-Centric Architecture

**Decision**: Core analysis logic implemented in MIPS assembly, not Python.

**Files**:
- `instruction_analyzer.asm` - Classifies instructions by type
- `heap_operations.asm` - First-Fit malloc/free
- `pipeline_simulator.asm` - 5-stage pipeline with hazards

**Rationale**:
- Educational: Students see MIPS doing real work
- Self-referential: MIPS analyzing MIPS
- Demonstrates practical assembly usage

**Python's Role**: Only orchestrates MARS execution and parses output

### 2. MARS Simulator Integration

**Decision**: Use MARS CLI via subprocess calls.

**Rationale**:
- Industry-standard MIPS simulator
- Accurate execution semantics
- No Java dependencies in Python

**Trade-offs**:
- Subprocess overhead (~100-500ms per execution)
- Limited to CLI capabilities

### 3. Vertical Tab Menu UI

**Decision**: Hamburger-style collapsible menu on right side.

**Rationale**:
- Maximizes content area (no 50/50 split)
- Mobile-friendly pattern
- Clean, modern UX

**Features**:
- Auto-closes after selection
- ESC key support
- Glassmorphism design

### 4. Three MIPS Core Files

**Decision**: Separate MIPS files for different analysis tasks.

**Status**:
- `instruction_analyzer.asm` ✅ Active (runs on every execution)
- `pipeline_simulator.asm` ✅ Active (Pipeline tab)
- `heap_operations.asm` ⚠️ Backend only (frontend pending)

---

## Data Flow

### Code Execution Flow

```
1. User writes code in Monaco Editor
2. Frontend → POST /api/execute {code, mode}
3. Backend writes code to temp.asm
4. Backend runs: java -jar mars.jar nc dec [registers] temp.asm
5. MARS executes, outputs register dump
6. Backend assembles code to extract instruction words
7. Backend injects words into instruction_analyzer.asm
8. Backend runs analyzer: java -jar mars.jar nc analyzer.asm
9. MIPS analyzer classifies instructions, writes to memory
10. Backend dumps memory, parses counters
11. Backend returns JSON {registers, output, analysis}
12. Frontend updates Register Display
```

**Key**: Steps 6-10 show MIPS analyzing user's MIPS code

### Instruction Decoder Flow

```
1. User types instruction in Decoder tab
2. Frontend → POST /api/decode/instruction {instruction}
3. Backend parses instruction (pure Python)
4. Backend determines format (R/I/J)
5. Backend encodes to binary
6. Backend returns JSON {format, fields, binary, hex}
7. Frontend displays color-coded breakdown
```

**No MARS execution** - pure Python encoding

### Pipeline Simulation Flow

```
1. User enters code in Pipeline tab
2. Frontend → POST /api/pipeline/simulate {code, enable_forwarding}
3. Backend assembles code to instruction words
4. Backend injects into pipeline_simulator.asm
5. Backend runs: java -jar mars.jar nc simulator.asm
6. MIPS simulator runs cycle-by-cycle pipeline
7. Backend dumps memory (stages, hazards, metrics)
8. Backend parses and returns JSON
9. Frontend displays 5 stages + metrics
```

**All logic in MIPS** - Python only parses output

---

## API Endpoints

### Execution API (`/api`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/execute` | POST | Execute MIPS code, return state |
| `/api/step` | POST | Step one instruction (not used) |
| `/api/reset` | POST | Reset state (not used) |
| `/api/state` | GET | Get current state (not used) |

### Decoder API (`/api/decode`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/decode/instruction` | POST | Decode single instruction |
| `/api/decode/program` | POST | Decode entire program (not used) |
| `/api/decode/info` | GET | Get decoder capabilities |

### Pipeline API (`/api/pipeline`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pipeline/simulate` | POST | Simulate 5-stage pipeline |
| `/api/pipeline/info` | GET | Get pipeline config |

### Heap API (`/api/heap`) - Not in Frontend

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/heap/allocate` | POST | Allocate memory (malloc) |
| `/api/heap/free` | POST | Free memory |
| `/api/heap/init` | POST | Initialize heap |
| `/api/heap/state` | GET | Get heap state |

---

## Memory Layout

Standard MIPS memory organization:

```
0x7FFFEFFC ┌──────────────┐ ← Stack Pointer ($sp)
           │    Stack     │   (grows down ↓)
           │      ↓       │
           ├──────────────┤
           │              │
           │  Free Space  │
           │              │
           ├──────────────┤
           │      ↑       │
           │     Heap     │   (grows up ↑)
0x10040000 ├──────────────┤ ← Heap Start
           │     Data     │   (static/global)
0x10010000 ├──────────────┤ ← Data Segment
           │     Text     │   (instructions)
0x00400000 └──────────────┘ ← Text Segment
```

---

## Frontend Architecture

### Component Hierarchy

```
page.tsx (Main)
├── WelcomeScreen (activeTab === 'welcome')
├── CodeEditor (activeTab === 'editor')
│   ├── Monaco Editor
│   ├── Examples Dropdown (floating)
│   └── Execute Button (floating)
├── RegisterDisplay (activeTab === 'registers')
├── InstructionDecoder (activeTab === 'decoder')
├── PipelineVisualizer (activeTab === 'pipeline')
├── VerticalTabMenu (always visible)
└── Toast (notifications)
```

### State Management

- **Local State**: React useState for UI state
- **No Global State**: Each tab manages own state
- **API Calls**: Direct fetch calls via `lib/api.ts`

### Styling

- **Tailwind CSS**: Utility-first styling
- **Glassmorphism**: `backdrop-blur-xl bg-white/10`
- **Dark Theme**: Default and only theme
- **Animations**: Framer Motion for transitions

---

## Backend Architecture

### Service Layer

**MarsExecutor**: Runs MARS simulator via subprocess
- Writes temp files
- Executes `java -jar mars.jar`
- Captures stdout/stderr
- 5-second timeout

**TraceParser**: Parses MARS output
- Extracts register values from dump
- Filters program output
- Creates ExecutionState object

**MipsAnalyzer**: Runs instruction analysis
- Assembles user code
- Injects into `instruction_analyzer.asm`
- Executes analyzer in MARS
- Parses memory dump for counters

**InstructionDecoder**: Encodes instructions to binary
- Pure Python (no MARS)
- Supports R/I/J formats
- Returns detailed field breakdown

**PipelineSimulator**: Runs pipeline simulation
- Injects into `pipeline_simulator.asm`
- Executes in MARS
- Parses stages, hazards, metrics

**AsmInjector**: Template injection utility
- Loads MIPS template files
- Replaces placeholders with values
- Writes combined MIPS program

**OutputParser**: Parses memory dumps
- Reads hex memory dumps
- Extracts values at offsets
- Converts to Python types

---

## Security Considerations

1. **Sandboxing**: MIPS code runs in MARS simulator (isolated)
2. **Temp Files**: Deleted after execution
3. **Timeout**: 5-10 second limits prevent infinite loops
4. **CORS**: Restricted to localhost:3000
5. **No File Access**: MIPS code cannot access host filesystem

---

## Performance Considerations

**Bottlenecks**:
- Subprocess overhead: 100-500ms per MARS execution
- Instruction analysis: 200-800ms (MIPS analyzer)
- Pipeline simulation: 300-1000ms (depends on code size)

**Optimizations**:
- Decoder uses pure Python (no MARS): <50ms
- Frontend uses dynamic imports for Monaco
- Backend uses async/await for I/O

**Not Implemented**:
- Caching (stateless execution model)
- Connection pooling (subprocess-based)

---

## Testing Strategy

**Backend**: Property-based tests with Hypothesis
- API contracts
- Hex/decimal conversions
- Memory segment ordering

**Frontend**: Property-based tests with fast-check
- Component rendering
- State transitions

**Manual Testing**: Example programs in `examples/`

---

## Technology Stack

**Frontend**:
- Next.js 16.1.1 (React framework with Turbopack)
- TypeScript 5.x
- Monaco Editor (VS Code engine)
- Framer Motion (animations)
- Lucide React (icons)
- Tailwind CSS (styling)

**Backend**:
- FastAPI 0.115+ (Python web framework)
- Pydantic 2.x (data validation)
- Hypothesis (property-based testing)
- MARS 4.5 (MIPS simulator)

**Development**:
- uv (Python package manager)
- npm (Node package manager)
- Git (version control)

---

## Future Enhancements

1. **Heap Visualizer**: Connect `heap_operations.asm` to frontend
2. **Step Execution**: True instruction-by-instruction stepping
3. **Memory Visualization**: Interactive memory layout display
4. **Cache Simulation**: L1/L2 cache visualization
5. **Multi-user**: Session-based state management
6. **Export**: Save execution traces as JSON

---

## References

- MIPS Green Sheet: https://inst.eecs.berkeley.edu/~cs61c/resources/MIPS_Green_Sheet.pdf
- MARS Simulator: http://courses.missouristate.edu/kenvollmar/mars/
- FastAPI Docs: https://fastapi.tiangolo.com/
- Next.js Docs: https://nextjs.org/docs
