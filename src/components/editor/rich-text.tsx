"use client";

import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Heading2, Italic, List, ListChecks, ListOrdered, Quote, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import "./rich-text.css";

export type { Editor, JSONContent };

const isEmptyDoc = (doc: unknown) => !doc || typeof doc !== "object" || !("type" in (doc as object));

/**
 * Edytor tekstu z formatowaniem (nagłówki, listy, checklisty, cytaty).
 * Zwraca dokument JSON i czysty tekst (do wyszukiwania i podglądu).
 */
export function RichText({
  content,
  onChange,
  placeholder,
  toolbarExtra,
  label,
  className,
  onReady,
}: {
  content: JSONContent | null;
  onChange: (doc: JSONContent, text: string) => void;
  placeholder?: string;
  toolbarExtra?: ReactNode;
  label: string;
  className?: string;
  onReady?: (editor: Editor) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: true, autolink: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? "Zacznij pisać…" }),
    ],
    content: isEmptyDoc(content) ? "" : content,
    editorProps: {
      attributes: { class: "cf-prose", "aria-label": label, role: "textbox", "aria-multiline": "true" },
    },
    onCreate: ({ editor }) => onReady?.(editor),
    onUpdate: ({ editor }) => onChange(editor.getJSON(), editor.getText({ blockSeparator: "\n" })),
  });

  return (
    <div className={cx("rounded-xl border border-line bg-surface focus-within:border-line-strong", className)}>
      {/* Pasek dopiero przy gotowym edytorze — useEditorState musi dostać istniejącą instancję. */}
      {editor ? <Toolbar editor={editor} extra={toolbarExtra} /> : <div className="h-11 border-b border-line" />}
      <EditorContent editor={editor} className="px-4 py-3 sm:px-5" />
    </div>
  );
}

function Toolbar({ editor, extra }: { editor: Editor; extra?: ReactNode }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      h2: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
    }),
  });

  const btn = (icon: LucideIcon, label: string, active: boolean, run: () => void) => {
    const Icon = icon;
    return (
      <button
        key={label}
        type="button"
        aria-label={label}
        aria-pressed={active}
        title={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={run}
        className={cx("pressable rounded-md p-2", active ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    );
  };
  const chain = () => editor.chain().focus();

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1" role="toolbar" aria-label="Formatowanie">
      {btn(Bold, "Pogrubienie", state.bold, () => chain().toggleBold().run())}
      {btn(Italic, "Kursywa", state.italic, () => chain().toggleItalic().run())}
      {btn(Heading2, "Nagłówek", state.h2, () => chain().toggleHeading({ level: 2 }).run())}
      <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
      {btn(List, "Lista", state.bullet, () => chain().toggleBulletList().run())}
      {btn(ListOrdered, "Lista numerowana", state.ordered, () => chain().toggleOrderedList().run())}
      {btn(ListChecks, "Checklista", state.task, () => chain().toggleTaskList().run())}
      {btn(Quote, "Cytat", state.quote, () => chain().toggleBlockquote().run())}
      {extra ? <div className="ml-auto flex items-center gap-1">{extra}</div> : null}
    </div>
  );
}
