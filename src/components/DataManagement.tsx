import React, { useState, useEffect } from 'react';
import { Plus, FolderPlus, Download, Upload, Trash2, Edit2, FileText, Check, Code, RefreshCw, Folder } from 'lucide-react';
import { Project, AppItem } from '../types';

export const DataManagement: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<AppItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal / Form state
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectDesc, setNewProjectDesc] = useState<string>('');

  const [showNewItemModal, setShowNewItemModal] = useState<boolean>(false);
  const [itemTitle, setItemTitle] = useState<string>('');
  const [itemCategory, setItemCategory] = useState<string>('general');
  const [itemPayload, setItemPayload] = useState<string>('{\n  "key": "value",\n  "status": "stored_in_cloud_sql"\n}');

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [bulkImportText, setBulkImportText] = useState<string>('[\n  {\n    "title": "Imported Record 1",\n    "category": "user_data",\n    "dataPayload": { "score": 98, "active": true }\n  }\n]');

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (e) {
      console.error('Failed to fetch projects', e);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const url = selectedProjectId ? `/api/items?projectId=${selectedProjectId}` : '/api/items';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (e) {
      console.error('Failed to fetch items', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [selectedProjectId]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName, description: newProjectDesc }),
      });
      const data = await res.json();
      if (data.success) {
        setNewProjectName('');
        setNewProjectDesc('');
        setShowNewProjectModal(false);
        fetchProjects();
      }
    } catch (e) {
      console.error('Error creating project', e);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle) return;

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          title: itemTitle,
          category: itemCategory,
          dataPayload: itemPayload,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setItemTitle('');
        setShowNewItemModal(false);
        fetchItems();
      }
    } catch (e) {
      console.error('Error creating item', e);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await fetch(`/api/items/${id}`, { method: 'DELETE' });
      fetchItems();
    } catch (e) {
      console.error('Error deleting item', e);
    }
  };

  const handleBulkImport = async () => {
    try {
      const parsed = JSON.parse(bulkImportText);
      const res = await fetch('/api/items/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsed, projectId: selectedProjectId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowImportModal(false);
        fetchItems();
      }
    } catch (e: any) {
      alert('Invalid JSON format for bulk import: ' + e.message);
    }
  };

  const exportAllAsJson = () => {
    const jsonStr = JSON.stringify(items, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudsql_export_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Actions Bar */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-100 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span>PostgreSQL App Records & Data Payloads</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Clean, error-free database storage for your web app data. No .gz compression issues!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0D1117] hover:bg-[#1C2128] text-gray-200 border border-[#30363D] rounded text-xs font-medium transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>New Project</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0D1117] hover:bg-[#1C2128] text-gray-200 border border-[#30363D] rounded text-xs font-medium transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>Import JSON</span>
          </button>

          <button
            onClick={exportAllAsJson}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0D1117] hover:bg-[#1C2128] text-gray-200 border border-[#30363D] rounded text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={() => setShowNewItemModal(true)}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Record</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Projects Sidebar & Items Table */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Projects Sidebar */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 space-y-3 h-fit">
          <div className="flex items-center justify-between pb-2 border-b border-[#30363D]">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-1">
              <Folder className="w-3.5 h-3.5 text-blue-400" />
              <span>Projects ({projects.length})</span>
            </span>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setSelectedProjectId(null)}
              className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors ${
                selectedProjectId === null
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:bg-[#1C2128] hover:text-gray-200'
              }`}
            >
              All Projects / Unassigned
            </button>

            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors flex items-center justify-between ${
                  selectedProjectId === p.id
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                    : 'text-gray-400 hover:bg-[#1C2128] hover:text-gray-200'
                }`}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0D1117] text-gray-400">
                  #{p.id}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Data Items Display */}
        <div className="lg:col-span-3 bg-[#161B22] border border-[#30363D] rounded-lg p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-200">
              Records ({items.length})
            </h3>
            <button
              onClick={fetchItems}
              className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
              title="Refresh Records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              Loading database records...
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-[#30363D] rounded-lg text-gray-500 space-y-3">
              <Code className="w-8 h-8 mx-auto text-gray-600" />
              <p className="text-xs">No records found. Click "Add New Record" to store data in PostgreSQL!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item) => (
                <div key={item.id} className="bg-[#0D1117] border border-[#30363D] rounded-lg p-4 space-y-3 hover:border-gray-600 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-400 border border-blue-500/20 uppercase">
                        {item.category}
                      </span>
                      <h4 className="font-bold text-gray-100 text-sm mt-1">{item.title}</h4>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1 text-gray-500 hover:text-rose-400 transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {item.dataPayload && (
                    <div className="bg-[#161B22] p-2.5 rounded border border-[#30363D]">
                      <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-32">
                        {item.dataPayload}
                      </pre>
                    </div>
                  )}

                  <div className="text-[10px] text-gray-500 flex items-center justify-between font-mono pt-1">
                    <span>ID: #{item.id}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-100">Create Target Web App Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., My Dashboard App"
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded p-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Purpose or notes for this app..."
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded p-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-4 py-2 bg-[#0D1117] text-gray-300 border border-[#30363D] rounded text-xs font-medium hover:bg-[#1C2128]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-500"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Record Modal */}
      {showNewItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-100">Add PostgreSQL Record</h3>
            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Title / Key Name</label>
                <input
                  type="text"
                  required
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="e.g., User Config Settings"
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded p-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Category</label>
                <input
                  type="text"
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  placeholder="general, settings, telemetry..."
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded p-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">JSON Data Payload</label>
                <textarea
                  rows={6}
                  value={itemPayload}
                  onChange={(e) => setItemPayload(e.target.value)}
                  className="w-full bg-[#0D1117] font-mono border border-[#30363D] rounded p-2.5 text-xs text-blue-300 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                  className="px-4 py-2 bg-[#0D1117] text-gray-300 border border-[#30363D] rounded text-xs font-medium hover:bg-[#1C2128]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-500"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-100">Bulk Import JSON Records</h3>
            <p className="text-xs text-gray-400">Paste JSON array of objects to insert directly into PostgreSQL.</p>
            <div>
              <textarea
                rows={8}
                value={bulkImportText}
                onChange={(e) => setBulkImportText(e.target.value)}
                className="w-full bg-[#0D1117] font-mono border border-[#30363D] rounded p-2.5 text-xs text-emerald-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-[#0D1117] text-gray-300 border border-[#30363D] rounded text-xs font-medium hover:bg-[#1C2128]"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                className="px-4 py-2 bg-sky-600 text-white rounded text-xs font-semibold hover:bg-sky-500"
              >
                Import JSON Records
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
