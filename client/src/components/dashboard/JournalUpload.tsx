import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface JournalUploadProps {
  lastUploadDate?: string | null;
  daysLeft?: number;
}

const JournalUpload: React.FC<JournalUploadProps> = ({ 
  lastUploadDate = null, 
  daysLeft = 7 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('journal', file);
      
      const response = await fetch('/api/journal/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to upload journal');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Journal Uploaded Successfully",
        description: "Your journal has been processed and saved.",
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['/api/journal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mood'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sleep'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity'] });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };
  
  const handleFile = (file: File) => {
    if (!file.type.includes('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFile(file);
  };
  
  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };
  
  const formatLastUpload = (dateString: string | null) => {
    if (!dateString) return "No previous uploads";
    const date = new Date(dateString);
    return `Last upload: ${date.toLocaleDateString()}`;
  };
  
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Journal Upload</h2>
          <span className="text-xs bg-yellow-100 text-yellow-800 py-1 px-2 rounded-full">
            Weekly: {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
          </span>
        </div>
        
        <div 
          className={`border-2 border-dashed ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-200'} rounded-lg p-6 text-center`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <div className="bg-green-100 text-green-600 p-2 rounded-full">
                  <FontAwesomeIcon icon="check" />
                </div>
                <span className="ml-2 text-sm text-gray-800">
                  {selectedFile.name}
                </span>
              </div>
              <button 
                className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium"
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Process Journal'}
              </button>
              {!uploadMutation.isPending && (
                <button 
                  className="block w-full text-xs text-gray-500 mt-2"
                  onClick={() => setSelectedFile(null)}
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            <>
              <FontAwesomeIcon icon="cloud-upload-alt" className="text-3xl text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 mb-3">
                Drag and drop your journal photo or click to browse
              </p>
              <label>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileSelect}
                />
                <span className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium cursor-pointer">
                  Upload Photo
                </span>
              </label>
              <p className="text-xs text-gray-400 mt-3">
                {formatLastUpload(lastUploadDate)}
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default JournalUpload;
