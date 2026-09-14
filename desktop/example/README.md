# A clearer view of your project

Welcome to **Halite**, a read-only Markdown reader for the files you already have.
Keep editing in Neovim or your favourite editor. Halite refreshes as you save.

## A small idea, fully connected

```mermaid
flowchart LR
  A[Your editor] -->|Save Markdown| B[Project folder]
  B -->|Live refresh| C[Halite]
  C --> D[Read and explore]
```

Use the explorer on the left, or press **Ctrl+K** to find a document.
Follow the [crystal notes](crystal.md) to see equations and a linked source file.

## Made for technical reading

| In your files | In Halite |
| --- | --- |
| Markdown | Headings, tables, task lists, and code |
| LaTeX notation | Typeset equations |
| Mermaid | Diagrams rendered locally |
| Relative links | A connected project, without an import |

### Bring your own project

Choose **File → Open Folder** or press **Ctrl+O**. Your project stays where it is.
To return here, choose **Help → Try the Example Project**.

Halite does not edit your project files. Your reading position and preferences
are saved separately on your computer.
