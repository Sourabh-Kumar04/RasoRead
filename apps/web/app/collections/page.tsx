"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Folder, FolderOpen, Trash2, Edit2, X, Loader2, BookOpen } from "lucide-react";
import { api, collectionsApi, booksApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Collection {
  id: string;
  name: string;
  description?: string;
  cover_color?: string;
  books_count?: number;
  created_at: string;
}

interface Book {
  id: string;
  title: string;
  author?: string;
  cover_url?: string;
  total_pages: number;
}

const COLORS = [
  "indigo", "emerald", "amber", "rose", "sky", "violet", "fuchsia", "teal"
];

export default function CollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [collectionBooks, setCollectionBooks] = useState<Book[]>([]);
  const [formData, setFormData] = useState({ name: "", description: "", cover_color: "indigo" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCollections();
    fetchBooks();
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await collectionsApi.list();
      setCollections(res.data);
    } catch (err) {
      console.error("Failed to fetch collections:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBooks = async () => {
    try {
      const res = await booksApi.list();
      setBooks(res.data);
    } catch (err) {
      console.error("Failed to fetch books:", err);
    }
  };

  const fetchCollectionBooks = async (collectionId: string) => {
    try {
      const res = await collectionsApi.get(collectionId);
      setCollectionBooks(res.data.books || []);
    } catch (err) {
      console.error("Failed to fetch collection books:", err);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      if (editingCollection) {
        await collectionsApi.update(editingCollection.id, formData);
      } else {
        await collectionsApi.create(formData);
      }
      setShowModal(false);
      setEditingCollection(null);
      setFormData({ name: "", description: "", cover_color: "indigo" });
      fetchCollections();
    } catch (err) {
      console.error("Failed to save collection:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this collection?")) return;
    try {
      await collectionsApi.delete(id);
      fetchCollections();
      if (selectedCollection?.id === id) setSelectedCollection(null);
    } catch (err) {
      console.error("Failed to delete collection:", err);
    }
  };

  const handleAddBook = async (bookId: string) => {
    if (!selectedCollection) return;
    try {
      await collectionsApi.addBook(selectedCollection.id, bookId);
      fetchCollectionBooks(selectedCollection.id);
    } catch (err) {
      console.error("Failed to add book:", err);
    }
  };

  const handleRemoveBook = async (bookId: string) => {
    if (!selectedCollection) return;
    try {
      await collectionsApi.removeBook(selectedCollection.id, bookId);
      fetchCollectionBooks(selectedCollection.id);
    } catch (err) {
      console.error("Failed to remove book:", err);
    }
  };

  const openCollection = (collection: Collection) => {
    setSelectedCollection(collection);
    fetchCollectionBooks(collection.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 pt-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 h-14 rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/10">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white"
          >
            ←
          </button>
          <span className="text-sm font-bold tracking-widest uppercase text-white/60">Collections</span>
          <button
            onClick={() => { setEditingCollection(null); setFormData({ name: "", description: "", cover_color: "indigo" }); setShowModal(true); }}
            className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-400"
          >
            <Plus size={18} />
          </button>
        </div>
      </header>

      <main className="pt-32 pb-24 px-6 max-w-4xl mx-auto">
        {selectedCollection ? (
          /* Collection Detail View */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => setSelectedCollection(null)}
              className="mb-6 text-zinc-500 hover:text-white text-sm"
            >
              ← Back to collections
            </button>
            <h1 className="text-3xl font-bold mb-2">{selectedCollection.name}</h1>
            {selectedCollection.description && (
              <p className="text-zinc-500 mb-8">{selectedCollection.description}</p>
            )}

            {collectionBooks.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {collectionBooks.map((book) => (
                  <div
                    key={book.id}
                    className="group relative p-4 rounded-2xl bg-zinc-900/40 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <button
                      onClick={() => handleRemoveBook(book.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
                    >
                      <X size={14} />
                    </button>
                    <div
                      onClick={() => router.push(`/reader/${book.id}`)}
                      className="cursor-pointer"
                    >
                      {book.cover_url ? (
                        <img src={book.cover_url} alt={book.title} className="w-full h-32 object-cover rounded-lg mb-3" />
                      ) : (
                        <div className="w-full h-32 bg-zinc-800 rounded-lg mb-3 flex items-center justify-center">
                          <BookOpen size={24} className="text-zinc-600" />
                        </div>
                      )}
                      <h3 className="font-semibold text-sm truncate">{book.title}</h3>
                      {book.author && <p className="text-xs text-zinc-500 truncate">{book.author}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-12">No books in this collection</p>
            )}

            {/* Add Books Section */}
            <div className="mt-8 pt-8 border-t border-white/10">
              <h2 className="text-lg font-semibold mb-4">Add Books</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {books
                  .filter((b) => !collectionBooks.some((cb) => cb.id === b.id))
                  .map((book) => (
                    <button
                      key={book.id}
                      onClick={() => handleAddBook(book.id)}
                      className="p-3 rounded-xl bg-zinc-900/40 border border-white/10 hover:border-indigo-500/50 text-left transition-all"
                    >
                      <p className="text-sm font-medium truncate">{book.title}</p>
                      {book.author && <p className="text-xs text-zinc-500 truncate">{book.author}</p>}
                    </button>
                  ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Collections List */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {collections.map((collection, idx) => (
                <motion.div
                  key={collection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative p-6 rounded-[2rem] bg-zinc-900/40 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                  onClick={() => openCollection(collection)}
                >
                  <div className="flex items-start justify-between">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      collection.cover_color === "indigo" && "bg-indigo-500/20 text-indigo-400",
                      collection.cover_color === "emerald" && "bg-emerald-500/20 text-emerald-400",
                      collection.cover_color === "amber" && "bg-amber-500/20 text-amber-400",
                      collection.cover_color === "rose" && "bg-rose-500/20 text-rose-400",
                      collection.cover_color === "sky" && "bg-sky-500/20 text-sky-400",
                      collection.cover_color === "violet" && "bg-violet-500/20 text-violet-400",
                      collection.cover_color === "fuchsia" && "bg-fuchsia-500/20 text-fuchsia-400",
                      collection.cover_color === "teal" && "bg-teal-500/20 text-teal-400",
                      !collection.cover_color && "bg-indigo-500/20 text-indigo-400"
                    )}>
                      <Folder size={20} />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingCollection(collection); setFormData({ name: collection.name, description: collection.description || "", cover_color: collection.cover_color || "indigo" }); setShowModal(true); }}
                        className="p-2 rounded-lg hover:bg-white/10"
                      >
                        <Edit2 size={14} className="text-zinc-400" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(collection.id); }}
                        className="p-2 rounded-lg hover:bg-red-500/20"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mt-4">{collection.name}</h3>
                  {collection.description && (
                    <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{collection.description}</p>
                  )}
                  <p className="text-xs text-zinc-600 mt-3">
                    {collection.books_count || 0} books
                  </p>
                </motion.div>
              ))}

              {/* Empty State */}
              {collections.length === 0 && (
                <div className="col-span-2 text-center py-16">
                  <FolderOpen size={48} className="text-zinc-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2">No collections yet</h2>
                  <p className="text-zinc-500 mb-6">Create your first collection to organize your books</p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-6 py-2 bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-400 transition-all"
                  >
                    Create Collection
                  </button>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 bg-zinc-900 border border-white/10 rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-6">
                {editingCollection ? "Edit Collection" : "New Collection"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full mt-2 bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                    placeholder="Collection name"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full mt-2 bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50 resize-none"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Color</label>
                  <div className="flex gap-2 mt-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormData({ ...formData, cover_color: color })}
                        className={cn(
                          "w-8 h-8 rounded-lg transition-all",
                          color === "indigo" && "bg-indigo-500",
                          color === "emerald" && "bg-emerald-500",
                          color === "amber" && "bg-amber-500",
                          color === "rose" && "bg-rose-500",
                          color === "sky" && "bg-sky-500",
                          color === "violet" && "bg-violet-500",
                          color === "fuchsia" && "bg-fuchsia-500",
                          color === "teal" && "bg-teal-500",
                          formData.cover_color === color ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : ""
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !formData.name.trim()}
                  className="flex-1 py-2 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-400 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin mx-auto" /> : editingCollection ? "Save" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}