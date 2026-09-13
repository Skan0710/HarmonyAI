import React, { useState, useRef } from 'react';
import { X, Upload, Link as LinkIcon, Sparkles, Trash2, Camera } from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from '../store/useToastStore';

interface EditProfilePictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPicture?: string;
  userName?: string;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80',
];

export const EditProfilePictureModal: React.FC<EditProfilePictureModalProps> = ({
  isOpen,
  onClose,
  currentPicture = '',
  userName = 'User',
}) => {
  const updateUser = useAuthStore((state) => state.updateUser);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'presets'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string>(currentPicture);
  const [urlInput, setUrlInput] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [imgLoadError, setImgLoadError] = useState(false);

  if (!isOpen) return null;

  // Process uploaded image file and resize to fit nicely
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setPreviewUrl(resizedDataUrl);
          setImgLoadError(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setPreviewUrl(urlInput.trim());
    setImgLoadError(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const response = await apiClient<{ success: boolean; data: any }>('/users/me', {
      method: 'PUT',
      body: JSON.stringify({ profilePicture: previewUrl }),
    });

    if (response.error) {
      toast.error(response.error || 'Failed to update profile picture');
      setSaving(false);
      return;
    }

    updateUser({ profilePicture: previewUrl });
    toast.success('Profile picture updated successfully!');
    setSaving(false);
    onClose();
  };

  const handleRemove = async () => {
    setSaving(true);
    const response = await apiClient<{ success: boolean; data: any }>('/users/me', {
      method: 'PUT',
      body: JSON.stringify({ profilePicture: '' }),
    });

    if (response.error) {
      toast.error('Failed to remove profile picture');
      setSaving(false);
      return;
    }

    updateUser({ profilePicture: '' });
    setPreviewUrl('');
    toast.info('Profile picture removed');
    setSaving(false);
    onClose();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-surface-1 border border-border-strong rounded-[var(--radius-lg)] p-6 shadow-2xl space-y-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent-wash text-accent flex items-center justify-center">
              <Camera size={16} />
            </div>
            <h2 className="text-lg font-bold text-text-primary">Update Profile Picture</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Preview Section */}
        <div className="flex items-center gap-5 p-4 bg-surface-2/60 border border-border-subtle rounded-[var(--radius-md)]">
          <div className="relative w-20 h-20 rounded-[var(--radius-lg)] overflow-hidden bg-surface-3 border border-border-subtle shrink-0 flex items-center justify-center">
            {previewUrl && !imgLoadError ? (
              <img
                src={previewUrl}
                alt={userName}
                onError={() => setImgLoadError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-accent-wash text-accent flex items-center justify-center font-bold text-xl">
                {getInitials(userName)}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text-primary">{userName}</p>
            <p className="text-xs text-text-tertiary">
              {previewUrl ? 'Custom photo selected' : 'Currently using default initials avatar'}
            </p>
            {previewUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs text-danger hover:text-danger-strong font-medium transition-colors cursor-pointer mt-1"
              >
                <Trash2 size={12} />
                Remove photo
              </button>
            )}
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-border-subtle">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'upload'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-tertiary hover:text-text-primary'
            }`}
          >
            <Upload size={14} />
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'url'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-tertiary hover:text-text-primary'
            }`}
          >
            <LinkIcon size={14} />
            Image URL
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'presets'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-tertiary hover:text-text-primary'
            }`}
          >
            <Sparkles size={14} />
            Presets
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border-strong hover:border-accent/60 rounded-[var(--radius-lg)] p-8 text-center cursor-pointer transition-colors bg-surface-2/30 hover:bg-surface-2/60 space-y-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-12 h-12 rounded-full bg-accent-wash text-accent flex items-center justify-center mx-auto">
              <Upload size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Click to select an image from your device</p>
              <p className="text-xs text-text-tertiary mt-1">PNG, JPG, or WebP (auto-optimized)</p>
            </div>
          </div>
        )}

        {activeTab === 'url' && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-text-secondary">Direct Image Link</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="flex-1 px-3.5 py-2.5 bg-surface-2 border border-border-subtle rounded-[var(--radius-sm)] text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 border border-border-subtle rounded-[var(--radius-sm)] text-xs font-semibold text-text-primary transition-colors cursor-pointer"
              >
                Preview
              </button>
            </div>
            <p className="text-2xs text-text-tertiary">Paste any direct public image URL to use as your avatar.</p>
          </div>
        )}

        {activeTab === 'presets' && (
          <div className="space-y-2">
            <p className="text-xs text-text-tertiary">Choose from curated aesthetic avatars:</p>
            <div className="grid grid-cols-6 gap-2.5">
              {PRESET_AVATARS.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPreviewUrl(url);
                    setImgLoadError(false);
                  }}
                  className={`aspect-square rounded-[var(--radius-md)] overflow-hidden border-2 transition-all cursor-pointer hover:scale-105 ${
                    previewUrl === url ? 'border-accent shadow-lg shadow-accent/20' : 'border-transparent'
                  }`}
                >
                  <img src={url} alt={`Preset ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-accent hover:bg-accent-strong text-text-on-accent text-xs font-semibold rounded-[var(--radius-pill)] transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
