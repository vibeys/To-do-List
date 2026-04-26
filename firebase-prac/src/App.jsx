import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import "./App.css";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const todosRef = collection(db, "todos");

  useEffect(() => {
    const unsubscribe = onSnapshot(todosRef, (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      setTodos(items);
    });
    return () => unsubscribe();
  }, []);

  const visibleTodos = useMemo(() => {
    let items = [...todos];

    if (search.trim()) {
      const query = search.toLowerCase();
      items = items.filter(
        (t) =>
          t.title?.toLowerCase().includes(query) ||
          t.details?.toLowerCase().includes(query)
      );
    }

    if (filter === "active")    items = items.filter((t) => !t.completed);
    if (filter === "completed") items = items.filter((t) => t.completed);

    const pOrder = { high: 3, medium: 2, low: 1 };

    items.sort((a, b) => {
      if (sortBy === "priority")
        return pOrder[b.priority || "medium"] - pOrder[a.priority || "medium"];
      if (sortBy === "oldest")
        return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortBy === "dueDate") {
        const aD = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bD = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aD - bD;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    return items;
  }, [todos, search, filter, sortBy]);

  const activeCount = useMemo(
    () => todos.filter((t) => !t.completed).length,
    [todos]
  );

  const resetForm = () => {
    setTitle("");
    setDetails("");
    setPriority("medium");
    setDueDate("");
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        details: details.trim(),
        priority,
        dueDate,
        updatedAt: Date.now(),
      };
      if (editingId) {
        await updateDoc(doc(db, "todos", editingId), payload);
      } else {
        await addDoc(todosRef, { ...payload, completed: false, createdAt: Date.now() });
      }
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async (id, current) => {
    await updateDoc(doc(db, "todos", id), {
      completed: !current,
      updatedAt: Date.now(),
    });
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "todos", id));
    if (editingId === id) resetForm();
  };

  const handleEdit = (todo) => {
    setTitle(todo.title || "");
    setDetails(todo.details || "");
    setPriority(todo.priority || "medium");
    setDueDate(todo.dueDate || "");
    setEditingId(todo.id);
  };

  const clearCompleted = async () => {
    const done = todos.filter((t) => t.completed);
    if (!done.length) return;
    const batch = writeBatch(db);
    done.forEach((t) => batch.delete(doc(db, "todos", t.id)));
    await batch.commit();
    if (editingId && done.some((t) => t.id === editingId)) resetForm();
  };

  const isOverdue = (todo) => {
    if (!todo.dueDate || todo.completed) return false;
    return new Date(`${todo.dueDate}T23:59:59`).getTime() < Date.now();
  };

  const formatDate = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  };

  return (
    <div className="app">
      <div className="notebook">

        {/* Header */}
        <header className="nb-header">
          <h1>My Tasks</h1>
          <span className="nb-count">
            {activeCount === 0
              ? "all done"
              : `${activeCount} remaining`}
          </span>
        </header>

        {/* Add / Edit form */}
        <form className="nb-form" onSubmit={handleSubmit}>
          <span className="nb-form-label">
            {editingId ? "Edit task" : "New task"}
          </span>

          <div className="nb-input-row">
            <div className="nb-title-wrap">
              <input
                className="nb-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Write the task here…"
                maxLength={120}
              />
            </div>

            <div className="nb-select-wrap">
              <label>Priority</label>
              <select
                className="nb-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="nb-date-wrap">
              <label>Due date</label>
              <input
                className="nb-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <textarea
            className="nb-textarea"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Optional notes…"
            rows={2}
            maxLength={300}
          />

          <div className="nb-form-actions">
            <button className="btn-primary" type="submit" disabled={loading}>
              {editingId ? "Save changes" : "Add task"}
            </button>
            {editingId && (
              <button className="btn-ghost" type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Toolbar */}
        <div className="nb-toolbar">
          <input
            className="nb-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
          />

          <div className="nb-filter-tabs">
            {["all", "active", "completed"].map((f) => (
              <button
                key={f}
                className={filter === f ? "active" : ""}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <select
            className="nb-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="priority">By priority</option>
            <option value="dueDate">By due date</option>
          </select>
        </div>

        {/* Task list */}
        <ul className="nb-list">
          {visibleTodos.length === 0 ? (
            <li className="nb-empty">
              {search
                ? "No tasks match your search."
                : filter === "completed"
                ? "Nothing completed yet."
                : "No tasks yet — add one above."}
            </li>
          ) : (
            visibleTodos.map((todo, i) => {
              const overdue = isOverdue(todo);
              return (
                <li
                  key={todo.id}
                  className={`nb-task ${todo.completed ? "done" : ""}`}
                >
                  <span className="nb-line-num">{i + 1}</span>

                  <div className="nb-check-wrap">
                    <input
                      className="nb-check"
                      type="checkbox"
                      checked={!!todo.completed}
                      onChange={() => toggleComplete(todo.id, todo.completed)}
                    />
                  </div>

                  <div className="nb-task-body">
                    <div className="nb-task-top">
                      <span className="nb-task-title">{todo.title}</span>
                      <span className={`nb-prio ${todo.priority || "medium"}`}>
                        {todo.priority || "medium"}
                      </span>
                      {overdue && (
                        <span className="nb-badge-overdue">overdue</span>
                      )}
                    </div>

                    {todo.details && (
                      <p className="nb-task-notes">{todo.details}</p>
                    )}

                    <div className="nb-task-meta">
                      {todo.dueDate && (
                        <span>Due {formatDate(todo.dueDate)}</span>
                      )}
                      <span>{todo.completed ? "Done" : "In progress"}</span>
                    </div>
                  </div>

                  <div className="nb-task-actions">
                    <button
                      className="btn-edit"
                      type="button"
                      onClick={() => handleEdit(todo)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-del"
                      type="button"
                      onClick={() => handleDelete(todo.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* Footer */}
        <div className="nb-footer">
          <button className="btn-clear" type="button" onClick={clearCompleted}>
            Clear completed tasks
          </button>
        </div>

      </div>
    </div>
  );
}
//ws
//finish job