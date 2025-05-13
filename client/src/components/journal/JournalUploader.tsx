import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, FileText, Pencil, Image, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JournalUploaderProps {
  onSuccess: (data: { journalId: number, text: string }) => void;
}

type OcrMethod = 'standard' | 'paddle' | 'webai' | 'htr' | 'enhanced-htr' | 'handwriting';

const methodLabels: Record<OcrMethod, string> = {
  'standard': 'Standardní OCR (pro tištěný text)',
  'paddle': 'PaddleOCR (lepší pro tištěný text)',
  'webai': 'WebAI OCR (optimalizováno pro digitální text)',
  'htr': 'HTR Základní (ruční text - základní)',
  'enhanced-htr': 'HTR Vylepšený (multi-průchod)',
  'handwriting': 'Handwriting.js (specializovaná knihovna)'
};

export function JournalUploader({ onSuccess }: JournalUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [method, setMethod] = useState<OcrMethod>('enhanced-htr');
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Vytvoření náhledu obrázku
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
      
      // Reset výsledků
      setRecognizedText('');
      setConfidence(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Chyba",
        description: "Prosím vyberte soubor pro nahrání",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('journal', file);
      
      // Vybrat správný endpoint podle zvolené metody
      const endpoint = `/api/journal/upload/${method === 'standard' ? '' : method}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Chyba při nahrávání deníku');
      }
      
      // Nastavení rozpoznaného textu a případně confidence
      setRecognizedText(data.text || '');
      setConfidence(data.confidence || null);
      
      toast({
        title: "Úspěch!",
        description: "Deníkový záznam byl úspěšně zpracován",
      });
      
      // Informovat nadřazenou komponentu
      onSuccess({
        journalId: data.journalId,
        text: data.text
      });
    } catch (error) {
      console.error('Error uploading journal:', error);
      toast({
        title: "Chyba zpracování",
        description: error instanceof Error ? error.message : "Nastala chyba při zpracování deníku",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Nahrát deníkový záznam</CardTitle>
        <CardDescription>
          Nahrajte obrázek nebo sken vašeho deníkového záznamu a my ho automaticky rozpoznáme a uložíme
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="ocr-method">Vyberte metodu rozpoznávání:</Label>
          <RadioGroup 
            id="ocr-method" 
            value={method} 
            onValueChange={(value) => setMethod(value as OcrMethod)}
            className="grid grid-cols-1 md:grid-cols-2 gap-2"
          >
            {(Object.entries(methodLabels) as [OcrMethod, string][]).map(([value, label]) => (
              <div key={value} className="flex items-center space-x-2">
                <RadioGroupItem value={value} id={`method-${value}`} />
                <Label htmlFor={`method-${value}`} className="cursor-pointer">
                  {label}
                  {value === 'enhanced-htr' && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">Doporučeno</span>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="journal-image">Nahrajte obrázek deníkového záznamu:</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-2">
              <Input 
                id="journal-image" 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                className="cursor-pointer"
              />
              <Button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Probíhá zpracování...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Rozpoznat text
                  </>
                )}
              </Button>
            </div>
            
            {preview && (
              <div className="relative aspect-video overflow-hidden rounded-md border">
                <img 
                  src={preview} 
                  alt="Náhled deníku" 
                  className="object-cover w-full h-full"
                />
              </div>
            )}
          </div>
        </div>
        
        {recognizedText && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="recognized-text">Rozpoznaný text:</Label>
              {confidence !== null && (
                <span className="text-xs text-muted-foreground">
                  Jistota: {Math.round(confidence * 100)}%
                </span>
              )}
            </div>
            <Textarea
              id="recognized-text"
              value={recognizedText}
              readOnly
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <div className="text-sm text-muted-foreground">
          <p className="flex items-start">
            <Brain className="mr-2 h-4 w-4 mt-0.5" />
            <span>
              <strong>Tip:</strong> Pro nejlepší výsledky použijte vylepšenou HTR metodu pro ručně psaný text a standardní OCR pro tištěný text.
            </span>
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}