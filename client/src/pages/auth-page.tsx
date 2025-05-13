import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";

// Components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

// Schemas
const loginSchema = z.object({
  username: z.string().min(2, "Uživatelské jméno musí mít alespoň 2 znaky"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});

const registerSchema = z.object({
  username: z.string().min(2, "Uživatelské jméno musí mít alespoň 2 znaky"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
  confirmPassword: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hesla se neshodují",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [location, navigate] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  
  // If user is already logged in, redirect to home page
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);
  
  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });
  
  function onLoginSubmit(values: LoginFormValues) {
    loginMutation.mutate(values);
  }
  
  function onRegisterSubmit(values: RegisterFormValues) {
    const { confirmPassword, ...registerData } = values;
    registerMutation.mutate(registerData);
  }
  
  return (
    <div className="container flex items-center justify-center min-h-screen">
      <div className="flex w-full max-w-5xl shadow-lg rounded-lg overflow-hidden">
        {/* Form Section */}
        <div className="w-full md:w-1/2 p-5 bg-white dark:bg-gray-950">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login">Přihlášení</TabsTrigger>
              <TabsTrigger value="register">Registrace</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Přihlášení</CardTitle>
                  <CardDescription>
                    Zadejte své přihlašovací údaje pro vstup do aplikace.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Uživatelské jméno</FormLabel>
                            <FormControl>
                              <Input placeholder="jmeno123" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Heslo</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="******" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Přihlašování...
                          </>
                        ) : (
                          "Přihlásit se"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex justify-center">
                  <p className="text-sm text-gray-500">
                    Nemáte účet?{" "}
                    <Button 
                      variant="link" 
                      className="p-0" 
                      onClick={() => setActiveTab("register")}
                    >
                      Registrujte se
                    </Button>
                  </p>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Registrace</CardTitle>
                  <CardDescription>
                    Vytvořte si nový účet pro používání aplikace.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Uživatelské jméno</FormLabel>
                            <FormControl>
                              <Input placeholder="jmeno123" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Heslo</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="******" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Potvrďte heslo</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="******" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Vytváření účtu...
                          </>
                        ) : (
                          "Vytvořit účet"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex justify-center">
                  <p className="text-sm text-gray-500">
                    Již máte účet?{" "}
                    <Button 
                      variant="link" 
                      className="p-0" 
                      onClick={() => setActiveTab("login")}
                    >
                      Přihlaste se
                    </Button>
                  </p>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Hero Section */}
        <div className="hidden md:block md:w-1/2 bg-gradient-to-r from-primary to-primary-foreground text-white p-10">
          <div className="h-full flex flex-col justify-center">
            <h1 className="text-4xl font-bold mb-4">WellDiary</h1>
            <p className="text-xl mb-8">
              Vaše osobní aplikace pro sledování nálady, spánku, aktivity a psaní deníku.
            </p>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="rounded-full bg-white/20 p-2 mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                </div>
                <div>
                  <h3 className="font-semibold">Deník s rozpoznáváním rukopisu</h3>
                  <p className="text-white/80">Nahrajte fotografie ručně psaných zápisů, které budou automaticky převedeny na text.</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="rounded-full bg-white/20 p-2 mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-activity"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
                <div>
                  <h3 className="font-semibold">Sledování zdraví</h3>
                  <p className="text-white/80">Monitorujte svou náladu, spánek a aktivitu pro lepší porozumění svému zdraví.</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="rounded-full bg-white/20 p-2 mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lightbulb"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                </div>
                <div>
                  <h3 className="font-semibold">AI Analýza</h3>
                  <p className="text-white/80">Získejte personalizované tipy na základě vašich dat a dosahování osobních cílů.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}