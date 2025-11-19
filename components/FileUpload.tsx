import React, { ChangeEvent } from 'react';
import { TimeframeLabel } from '../types';

interface FileUploadProps {
  label: TimeframeLabel;
  description: string;
  imagePreview: string | null;
  onFileSelect: (label: TimeframeLabel, file: File) => void;
  onRemove: (label: TimeframeLabel) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  description, 
  imagePreview, 
  onFileSelect, 
  onRemove,
  disabled = false 
}) => {
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(label, e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-bold text-slate-200 uppercase tracking-wider">{label}</span>
        <span className="text-xs text-slate-400">{description}</span>
      </div>
      
      <div className={`
        relative group border-2 border-dashed border-slate-600 rounded-xl 
        bg-slate-800/50 hover:bg-slate-800 transition-all duration-300
        min-h-[200px] flex flex-col items-center justify-center overflow-hidden
        ${imagePreview ? 'border-solid border-trading-accent/50' : ''}
      `}>
        
        {imagePreview ? (
          <>
            <img 
              src={imagePreview} 
              alt={`${label} preview`} 
              className="w-full h-full object-contain absolute inset-0 z-0"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
               <button 
                 onClick={() => onRemove(label)}
                 className="bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded-full font-medium text-sm backdrop-blur-sm transform hover:scale-105 transition-transform"
                 disabled={disabled}
               >
                 Remove Image
               </button>
            </div>
          </>
        ) : (
          <label className={`flex flex-col items-center justify-center w-full h-full cursor-pointer z-10 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
            <svg className="w-10 h-10 text-slate-400 mb-3 group-hover:text-trading-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <p className="text-sm text-slate-300 font-medium">Click to Upload</p>
            <p className="text-xs text-slate-500 mt-1">Screenshots, Charts</p>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*"
              onChange={handleInputChange}
              disabled={disabled}
            />
          </label>
        )}
      </div>
    </div>
  );
};

export default FileUpload;