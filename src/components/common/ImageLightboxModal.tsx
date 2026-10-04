import React from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImageLightboxModalProps {
  isOpen: boolean
  imageUrl: string | null
  onClose: () => void
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  imageUrl,
  onClose,
}) => {
  const [zoom, setZoom] = React.useState(1)

  if (!isOpen || !imageUrl) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl h-[90vh] bg-slate-900 rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-slate-800">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-900/90 border-b border-slate-800 text-white z-10">
          <span className="text-xs font-bold text-slate-300">Original Ledger Inspection</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold px-2">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 ml-1"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 ml-4"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
          <div
            className="transition-transform duration-150 origin-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={imageUrl}
              alt="Original Ledger Full Preview"
              className="max-h-[78vh] object-contain rounded-xl shadow-2xl bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
