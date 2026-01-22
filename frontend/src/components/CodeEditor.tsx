"use client";

import { useRef, useEffect } from "react";
import Editor, { OnMount, Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface CodeEditorProps {
  code: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  errorLine?: number;  // Line number with syntax error (1-indexed)
}

// MIPS syntax highlighting configuration
const registerMIPSLanguage = (monaco: Monaco) => {
  // Register MIPS language
  monaco.languages.register({ id: "mips" });

  // Define MIPS tokens
  monaco.languages.setMonarchTokensProvider("mips", {
    ignoreCase: true,
    tokenizer: {
      root: [
        // Comments
        [/#.*$/, "comment"],

        // Directives
        [/\.(text|data|globl|word|byte|half|space|asciiz|ascii|align|float|double)\b/, "keyword.directive"],

        // Labels
        [/^[a-zA-Z_][a-zA-Z0-9_]*:/, "type.identifier"],

        // Registers
        [/\$zero|\$at|\$v[0-1]|\$a[0-3]|\$t[0-9]|\$s[0-7]|\$k[0-1]|\$gp|\$sp|\$fp|\$ra/, "variable.register"],
        [/\$[0-9]+/, "variable.register"],

        // Instructions - R-type
        [/\b(add|addu|sub|subu|and|or|xor|nor|slt|sltu|sll|srl|sra|sllv|srlv|srav|jr|jalr|mult|multu|div|divu|mfhi|mflo|mthi|mtlo)\b/, "keyword.instruction"],

        // Instructions - I-type
        [/\b(addi|addiu|andi|ori|xori|slti|sltiu|lui|lw|sw|lb|sb|lh|sh|lbu|lhu|beq|bne|blez|bgtz|bltz|bgez)\b/, "keyword.instruction"],

        // Instructions - J-type
        [/\b(j|jal)\b/, "keyword.instruction"],

        // Pseudo-instructions
        [/\b(li|la|move|blt|bgt|ble|bge|nop|syscall|break)\b/, "keyword.pseudo"],

        // Numbers
        [/0x[0-9a-fA-F]+/, "number.hex"],
        [/-?[0-9]+/, "number"],

        // Strings
        [/"[^"]*"/, "string"],

        // Identifiers (labels used as operands)
        [/[a-zA-Z_][a-zA-Z0-9_]*/, "identifier"],
      ],
    },
  });

  // Define MIPS theme colors - matching our purple-blue design
  monaco.editor.defineTheme("mips-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6d7a96", fontStyle: "italic" },
      { token: "keyword.directive", foreground: "c4b5fd" },
      { token: "keyword.instruction", foreground: "a78bfa" },
      { token: "keyword.pseudo", foreground: "818cf8" },
      { token: "variable.register", foreground: "c7d2fe" },
      { token: "number", foreground: "86efac" },
      { token: "number.hex", foreground: "86efac" },
      { token: "string", foreground: "fca5a5" },
      { token: "type.identifier", foreground: "fde68a" },
      { token: "identifier", foreground: "e2e8f0" },
    ],
    colors: {
      "editor.background": "#0d0d1a",
      "editor.foreground": "#e2e8f0",
      "editorLineNumber.foreground": "#4c4c7a",
      "editorLineNumber.activeForeground": "#a78bfa",
      "editor.lineHighlightBackground": "#1a1a35",
      "editor.selectionBackground": "#3730a3",
      "editorCursor.foreground": "#a78bfa",
    },
  });
};

export default function CodeEditor({ code, onChange, readOnly = false, errorLine }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register MIPS language if not already registered
    if (!monaco.languages.getLanguages().some((lang: { id: string }) => lang.id === "mips")) {
      registerMIPSLanguage(monaco);
    }

    // Set the theme strictly
    monaco.editor.setTheme("mips-dark");
  };

  // Provide an immediate theme to prevent white flash
  const editorTheme = "mips-dark";

  // Update error line decorations when errorLine changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Clear previous decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);

    // Add new decoration if there's an error line
    if (errorLine && errorLine > 0) {
      decorationsRef.current = editor.deltaDecorations([], [
        {
          range: new monaco.Range(errorLine, 1, errorLine, 1),
          options: {
            isWholeLine: true,
            className: "error-line-decoration",
            glyphMarginClassName: "error-glyph-margin",
            linesDecorationsClassName: "error-line-decoration-margin",
            overviewRuler: {
              color: "#ef4444",
              position: monaco.editor.OverviewRulerLane.Full,
            },
          },
        },
      ]);

      // Scroll to the error line
      editor.revealLineInCenter(errorLine);
    }
  }, [errorLine]);

  const handleChange = (value: string | undefined) => {
    if (onChange && value !== undefined) {
      onChange(value);
    }
  };

  return (
    <div className="h-full w-full code-editor-wrapper">
      <Editor
        height="100%"
        defaultLanguage="mips"
        language="mips"
        value={code}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme={editorTheme}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          wordWrap: "off",
          folding: true,
          lineDecorationsWidth: 10,
          renderLineHighlight: "line",
          selectOnLineNumbers: true,
          roundedSelection: true,
          cursorStyle: "line",
          cursorBlinking: "smooth",
        }}
      />
    </div>
  );
}
