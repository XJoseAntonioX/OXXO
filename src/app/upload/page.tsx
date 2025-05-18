"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from 'papaparse';
import Image from "next/image";

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith('.csv')) {
        setError("Por favor selecciona un archivo CSV válido");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError("Por favor selecciona un archivo CSV");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Parse the CSV file
      const text = await file.text();
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`Error al analizar el archivo CSV: ${results.errors[0].message}`);
            setIsLoading(false);
            return;
          }

          try {
            // Store the parsed data in localStorage
            localStorage.setItem('planogramaData', JSON.stringify(results.data));
            localStorage.setItem('planogramaFileName', file.name);
            
            // Redirect to the main page
            setTimeout(() => {
              router.push('/');
            }, 500);
          } catch (err) {
            console.error("Storage error:", err);
            setError("Error al guardar los datos. El archivo puede ser demasiado grande.");
            setIsLoading(false);
          }
        },
        error: (error: Error) => {
          setError(`Error al analizar el archivo CSV: ${error.message}`);
          setIsLoading(false);
        }
      });
    } catch (err) {
      console.error("File processing error:", err);
      setError(`Error al procesar el archivo: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with OXXO branding */}
      <header className="bg-[#dd2324] py-4 px-8 shadow-md flex justify-between items-center">
        <div className="flex items-center">
          <div className="relative mr-4 w-[80px] h-[30px] flex items-center">
            <Image 
              src="/Oxxo_Logo.svg" 
              alt="OXXO Logo" 
              width={80} 
              height={30}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-bold font-[family-name:var(--font-geist-sans)] text-white hover:text-[#fec76f] transition-colors duration-300">
            Guía de planograma
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-[#fec76f]">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-[#dd2324] text-center">Subir Archivo CSV</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-gray-700 font-medium">
                Archivo de planograma (CSV)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full border-2 border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#dd2324] focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:bg-[#dd2324] file:text-white hover:file:bg-red-600"
              />
              {file ? (
                <p className="text-sm text-black">
                  Archivo seleccionado: {file.name}
                </p>
              ) : (
                <p className="text-sm text-black">
                  No se eligió ningún archivo
                </p>
              )}
            </div>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={isLoading || !file}
              className={`w-full py-3 px-4 rounded-md text-white font-medium ${
                isLoading || !file ? 'bg-gray-400' : 'bg-[#dd2324] hover:bg-red-600'
              } transition-colors duration-300`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Procesando...
                </span>
              ) : (
                'Cargar y Continuar'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
