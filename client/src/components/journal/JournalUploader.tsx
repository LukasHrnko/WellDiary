import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, FileText, Pencil, Image, Brain, Moon, Footprints, BedIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Slider } from "@/components/ui/slider";

interface JournalUploaderProps {
  onSuccess: (data: { journalId: number, text: string }) => void;
}

const formSchema = z.object({
  text: z.string().optional(),
  mood: z.number().min(1).max(100),
  sleep: z.number().min(0).max(24),
  steps: z.number().min(0),
});

type OcrMethod = 'trocr';

const methodLabels: Record<OcrMethod, string> = {
  'trocr': 'TrOCR (Optimalizovaný s podporou češtiny)'
};

export function JournalUploader({ onSuccess }: JournalUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [method, setMethod] = useState<OcrMethod>('trocr');
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
  const [recordId, setRecordId] = useState<number | null>(null);
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text: "",
      mood: 70,
      sleep: 8,
      steps: 5000,
    },
  });

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
      
      // Použijeme vždy jen TrOCR endpoint
      const endpoint = '/api/journal/upload/trocr';
      
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
      form.setValue("text", data.text || '');
      setRecordId(data.journalId);
      
      toast({
        title: "Úspěch!",
        description: "Text byl úspěšně rozpoznán, nyní můžete doplnit další údaje",
      });
      
      // Přepnout na kartu pro doplnění dat
      setActiveTab("details");
      
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
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // Odeslat kompletní záznam s metadaty
      const response = await fetch('/api/journal/entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journalId: recordId,
          moodValue: values.mood,
          sleepHours: values.sleep,
          steps: values.steps,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Chyba při ukládání deníkového záznamu');
      }
      
      toast({
        title: "Úspěch!",
        description: "Deníkový záznam byl úspěšně uložen",
      });
      
      // Informovat nadřazenou komponentu
      onSuccess({
        journalId: recordId || data.journalId,
        text: values.text || recognizedText
      });
    } catch (error) {
      console.error('Error saving journal entry:', error);
      toast({
        title: "Chyba ukládání",
        description: error instanceof Error ? error.message : "Nastala chyba při ukládání deníku",
        variant: "destructive",
      });
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
        <Tabs defaultValue="upload" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Nahrát obrázek</TabsTrigger>
            <TabsTrigger value="details" disabled={!recognizedText}>Doplnit údaje</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-6">
            <div className="text-sm text-primary font-medium mb-4">
              <div className="flex items-center">
                <span className="mr-2">Metoda rozpoznávání: TrOCR</span>
                <span className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">Optimalizováno pro češtinu</span>
              </div>
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
                <Button 
                  className="w-full mt-4" 
                  onClick={() => setActiveTab("details")}
                >
                  Pokračovat k doplnění údajů
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="details">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deníkový záznam</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Váš deníkový záznam" 
                          className="min-h-[150px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Text byl automaticky rozpoznaný z nahrané fotografie. Můžete jej upravit.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="mood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Moon className="mr-2 h-4 w-4" />
                        Nálada
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            min={1}
                            max={100}
                            step={1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-4"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Špatná</span>
                            <span>Neutrální</span>
                            <span>Skvělá</span>
                          </div>
                          <div className="text-center font-medium mt-2">
                            {field.value}/100
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="sleep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <BedIcon className="mr-2 h-4 w-4" />
                        Spánek (hodin)
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            min={0}
                            max={12}
                            step={0.5}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-4"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0h</span>
                            <span>6h</span>
                            <span>12h</span>
                          </div>
                          <div className="text-center font-medium mt-2">
                            {field.value} hodin
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="steps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Footprints className="mr-2 h-4 w-4" />
                        Kroky
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            min={0}
                            max={20000}
                            step={500}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-4"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0</span>
                            <span>10000</span>
                            <span>20000</span>
                          </div>
                          <div className="text-center font-medium mt-2">
                            {field.value.toLocaleString()} kroků
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-between space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab("upload")}
                    className="flex-1"
                  >
                    Zpět k nahrávání
                  </Button>
                  <Button type="submit" className="flex-1">
                    Uložit deníkový záznam
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <div className="text-sm text-muted-foreground">
          <p className="flex items-start">
            <Brain className="mr-2 h-4 w-4 mt-0.5" />
            <span>
              <strong>Tip:</strong> TrOCR je optimalizováno pro rozpoznávání českého rukopisu. Pro nejlepší výsledky ujistěte se, že je text na obrázku dobře viditelný a čitelný.
            </span>
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}