"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Papa from 'papaparse';
import { useRouter } from "next/navigation";

interface PlanogramaItem {
  Charola: string;
  Nombre: string;
  "Cantidad de Frentes"?: string | number; // Add this field
  // Add other fields as needed from your CSV
}

// Add interface for the JSON layout data
interface PlanogramaLayout {
  grupo: number;
  charola: number;
  sku: string;
  x: number;
  y: number;
  w: number;
  h: number;
  img: string | null;
  color: number[];
}

// Add this interface for product image sizes
interface ProductImageSizes {
  [key: string]: { width: number; height: number };
}

export default function Simulation() {
  const [isSimulationStarted, setIsSimulationStarted] = useState(false);
  const [planogramaData, setPlanogramaData] = useState<Record<string, PlanogramaItem>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState<number>(1);
  const [estanteNumber, setEstanteNumber] = useState<number>(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState<boolean>(false);
  
  // Add state for layout data
  const [layoutData, setLayoutData] = useState<PlanogramaLayout[]>([]);
  const [currentGrupo, setCurrentGrupo] = useState<number>(1);
  const [displayedProducts, setDisplayedProducts] = useState<PlanogramaLayout[]>([]);
  const [productImageErrors, setProductImageErrors] = useState<Record<string, boolean>>({});

  // Add ref for the estante container
  const estanteContainerRef = useRef<HTMLDivElement>(null);
  
  // Add state for storing original image dimensions
  const [productImageSizes, setProductImageSizes] = useState<ProductImageSizes>({});

  // Audio playback states
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [currentAudioIndex, setCurrentAudioIndex] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(false);
  // Add state for audio connection retry
  const [isRetryingAudio, setIsRetryingAudio] = useState<boolean>(false);
  
  // Add state for checking if data exists
  const [hasUploadedData, setHasUploadedData] = useState<boolean>(false);
  const router = useRouter();
  
  // Check for uploaded data when component mounts
  useEffect(() => {
    const storedData = localStorage.getItem('planogramaData');
    if (storedData) {
      setHasUploadedData(true);
    } else {
      // Redirect to upload page if no data exists
      router.push('/upload');
    }
  }, [router]);
  
  const handleStartSimulation = () => {
    setIsSimulationStarted(true);
    loadPlanogramaData();
    loadLayoutData();
    
    // Set the current audio index to the first record
    setCurrentAudioIndex(0);
    
    // Play the first audio if audio service is available
    if (audioAvailable) {
      playAudioForIndex(0);
    }
  };

  // Add function to load JSON layout data
  const loadLayoutData = async () => {
    try {
      const response = await fetch('/planograma_layout.json');
      const data = await response.json();
      setLayoutData(data);
    } catch (err) {
      console.error("JSON loading error:", err);
      setError(`Error loading layout file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const loadPlanogramaData = async () => {
    setIsLoading(true);
    try {
      // Check if we have uploaded data in localStorage
      const storedData = localStorage.getItem('planogramaData');
      
      if (storedData) {
        // Use the data from localStorage
        const parsedData = JSON.parse(storedData);
        
        // Group items by Charola
        const groupedData: Record<string, PlanogramaItem[]> = {};
        
        parsedData.forEach((item: any) => {
          const charola = item.Charola || 'Sin Charola';
          if (!groupedData[charola]) {
            groupedData[charola] = [];
          }
          groupedData[charola].push(item);
        });
        
        setPlanogramaData(groupedData);
        setIsLoading(false);
      } else {
        // Fall back to loading from the static file
        const response = await fetch('/Planograma_bueno.csv');
        const csvText = await response.text();
        
        Papa.parse<PlanogramaItem>(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            // Group items by Charola
            const groupedData: Record<string, PlanogramaItem[]> = {};
            
            results.data.forEach((item) => {
              const charola = item.Charola || 'Sin Charola';
              if (!groupedData[charola]) {
                groupedData[charola] = [];
              }
              groupedData[charola].push(item);
            });
            
            setPlanogramaData(groupedData);
            setIsLoading(false);
          },
          error: (error) => {
            setError(`Error parsing CSV: ${error.message}`);
            setIsLoading(false);
          }
        });
      }
    } catch (err) {
      console.error("CSV loading error:", err);
      setError(`Error loading file: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
    }
  };

  // Update displayed products based on display count
  useEffect(() => {
    if (layoutData.length > 0) {
      // Get products up to current display count
      const productsToShow = layoutData.slice(0, displayCount);
      setDisplayedProducts(productsToShow);
      
      // Update current grupo based on latest product
      if (productsToShow.length > 0) {
        const latestProduct = productsToShow[productsToShow.length - 1];
        setCurrentGrupo(latestProduct.grupo);
      }
    }
  }, [displayCount, layoutData]);

  // Fetch total records when component mounts, with better error handling
  useEffect(() => {
    const fetchTotalRecords = async () => {
      try {
        setIsRetryingAudio(true);
        
        // Add a timeout to the fetch to avoid long waiting times
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        // Use try-catch specifically for the fetch operation
        try {
          const response = await fetch('http://localhost:8000/total-records', {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
          }
          
          const data = await response.json();
          setTotalRecords(data.total);
          setAudioAvailable(true); // Audio service is available
          setAudioError(null);
        } catch (fetchError: any) {
          console.error("Fetch error:", fetchError);
          throw fetchError; // Rethrow to be caught by the outer try-catch
        }
      } catch (err: any) {
        console.error("Error fetching total records:", err);
        setAudioAvailable(false);
        if (err.name === 'AbortError') {
          setAudioError("Audio service timed out. Audio narration disabled.");
        } else if (err.message?.includes('fetch')) {
          setAudioError("Could not connect to audio server. Run the audio server to enable narration.");
        } else {
          setAudioError("Audio service unavailable. Audio narration disabled.");
        }
      } finally {
        setIsRetryingAudio(false);
      }
    };
    
    fetchTotalRecords();
  }, []);

  // Add a function to retry audio connection
  const retryAudioConnection = () => {
    const fetchTotalRecords = async () => {
      try {
        setIsRetryingAudio(true);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch('http://localhost:8000/total-records', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        setTotalRecords(data.total);
        setAudioAvailable(true);
        setAudioError(null);
      } catch (err: any) {
        console.error("Error retrying audio connection:", err);
        setAudioAvailable(false);
        if (err.name === 'AbortError') {
          setAudioError("Audio service timed out. Audio narration disabled.");
        } else {
          setAudioError("Audio service unavailable. Please make sure audio.py is running.");
        }
      } finally {
        setIsRetryingAudio(false);
      }
    };
    
    fetchTotalRecords();
  };

  // Modified function to play audio only if available
  const playAudioForIndex = async (index: number) => {
    if (!audioAvailable) return; // Skip if audio is not available
    
    if (audioPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }

    try {
      setAudioPlaying(true);
      setAudioError(null);
      
      // Create audio element if it doesn't exist
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      // Set audio source
      audioRef.current.src = `http://localhost:8000/audio/${index}`;
      
      // Play the audio
      await audioRef.current.play();
      
      // Update state when audio finishes
      audioRef.current.onended = () => {
        setAudioPlaying(false);
      };
      
      // Handle errors
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error:", e);
        setAudioError("Error playing audio.");
        setAudioPlaying(false);
      };
      
    } catch (err) {
      console.error("Audio error:", err);
      setAudioError("Error playing audio.");
      setAudioPlaying(false);
    }
  };

  // Update navigation functions to play audio only if available
  const handleAddRecord = () => {
    if (layoutData.length > 0) {
      const newDisplayCount = Math.min(displayCount + 1, layoutData.length);
      setDisplayCount(newDisplayCount);
      
      // Play audio for the newly added record, only if audio is available
      if (audioAvailable && newDisplayCount > 0 && newDisplayCount <= totalRecords) {
        const newAudioIndex = Math.min(currentAudioIndex + 1, totalRecords - 1);
        setCurrentAudioIndex(newAudioIndex);
        playAudioForIndex(newAudioIndex);
      }
    } else {
      // Fallback to original behavior
      const totalItems = Object.values(planogramaData).reduce(
        (sum, items) => sum + items.length, 0);
      setDisplayCount(prev => Math.min(prev + 1, totalItems));
      
      // Play audio for the newly added record, only if audio is available
      if (audioAvailable && displayCount < totalItems && displayCount < totalRecords) {
        const newAudioIndex = Math.min(currentAudioIndex + 1, totalRecords - 1);
        setCurrentAudioIndex(newAudioIndex);
        playAudioForIndex(newAudioIndex);
      }
    }
  };

  const handleRemoveRecord = () => {
    setDisplayCount(prev => Math.max(prev - 1, 1));
    
    // Play audio for the previous record, only if audio is available
    if (audioAvailable && currentAudioIndex > 0) {
      const newAudioIndex = currentAudioIndex - 1;
      setCurrentAudioIndex(newAudioIndex);
      playAudioForIndex(newAudioIndex);
    }
  };

  // Handle product image errors
  const handleProductImageError = (sku: string) => {
    setProductImageErrors(prev => ({...prev, [sku]: true}));
  };

  // Helper function to get flattened items array 
  const getFlattenedItems = () => {
    const result: {charola: string, item: PlanogramaItem}[] = [];
    
    // Sort charolas to ensure consistent order
    const charolaKeys = Object.keys(planogramaData).sort();
    
    charolaKeys.forEach(charola => {
      planogramaData[charola].forEach(item => {
        result.push({charola, item});
      });
    });
    
    return result;
  };

  // Add useEffect to scroll to bottom when displayCount changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      // Small timeout to ensure content is rendered before scrolling
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [displayCount]);

  // Add functions to navigate estante images
  const handleNextEstante = () => {
    if (!isSimulationStarted) {
      setEstanteNumber(prev => prev + 1);
    }
  };

  const handlePrevEstante = () => {
    if (!isSimulationStarted) {
      setEstanteNumber(prev => Math.max(prev - 1, 1));
    }
  };

  // Reset image error state when estante number changes
  useEffect(() => {
    setImageError(false);
  }, [estanteNumber, currentGrupo]);

  // Handle image error by falling back to estante 1
  const handleImageError = () => {
    setImageError(true);
    if (!isSimulationStarted) {
      setEstanteNumber(1);
    }
  };
  
  // Get correct estante number based on simulation state
  const currentEstante = isSimulationStarted ? 
    (imageError ? 1 : currentGrupo) : 
    (imageError ? 1 : estanteNumber);

  // Updated function to calculate total sum of all "Cantidad de Frentes" values
  const calculateTotalFrentes = () => {
    let total = 0;
    
    // Get all records and sum their "Cantidad de Frentes" values
    Object.values(planogramaData).forEach(charolaItems => {
      charolaItems.forEach(item => {
        // Parse the value as number, default to 1 if missing or NaN
        const frentes = item["Cantidad de Frentes"] 
          ? Number(item["Cantidad de Frentes"]) 
          : 1;
        total += isNaN(frentes) ? 1 : frentes;
      });
    });
    
    return total;
  };
  
  // Calculate accumulative count up to current display index
  const calculateAccumulativeCount = () => {
    const flattenedItems = getFlattenedItems();
    let accumulativeCount = 0;
    
    // Calculate accumulative frentes count up to displayCount
    for (let i = 0; i < Math.min(displayCount, flattenedItems.length); i++) {
      const frentes = flattenedItems[i].item["Cantidad de Frentes"] 
        ? Number(flattenedItems[i].item["Cantidad de Frentes"]) 
        : 1;
      accumulativeCount += isNaN(frentes) ? 1 : frentes;
    }
    
    // Get the complete total of all frentes
    const totalFrentes = calculateTotalFrentes();
    
    return { accumulativeCount, totalFrentes };
  };

  // Function to transform coordinates while preserving original image sizes
  const getBottomLeftPosition = (product: PlanogramaLayout) => {
    if (!estanteContainerRef.current) return { x: 0, y: 0 };
    
    const containerHeight = estanteContainerRef.current.clientHeight;
    
    // X remains the same (from left) but with reduced offset to move left
    const x = product.x + 35; // Reduced from 100 to 60 to move left
    
    // Y is inverted (from bottom instead of from top)
    // Adjusted offset to move images higher
    const y = containerHeight - (product.y + product.h); // Changed from -30 to -10 to move higher
    
    return { x, y };
  };
  
  // Add a function to go back to upload page
  const handleBackToUpload = () => {
    // Clear local storage and redirect to upload page
    localStorage.removeItem('planogramaData');
    localStorage.removeItem('planogramaFileName');
    router.push('/upload');
  };

  // Show loading until we know if there's uploaded data
  if (!hasUploadedData && !isLoading && !error) {
    return (
      <div className="flex flex-col min-h-screen">
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
        <div className="flex-1 flex items-center justify-center bg-[#fec76f]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#dd2324] mx-auto mb-4"></div>
            <p className="text-lg text-gray-700">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with new background color */}
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
        
        {/* Updated upload button in header with styled hover effect */}
        <button
          onClick={handleBackToUpload}
          className="text-white font-bold font-[family-name:var(--font-geist-sans)] hover:bg-red-600 px-4 py-2 rounded transition-colors duration-300"
        >
          Subir Nuevo CSV
        </button>
      </header>
      
      {/* Main content split into two sections */}
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Left section - conditionally render button or table */}
        <section className="w-full md:w-1/2 bg-[#fec76f] flex items-center justify-center p-6">
          {!isSimulationStarted ? (
            <button 
              className="px-8 py-4 bg-white text-[#dd2324] font-medium text-lg rounded-full shadow-lg hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all duration-300 font-[family-name:var(--font-geist-sans)]"
              onClick={handleStartSimulation}
            >
              Iniciar Simulación
            </button>
          ) : (
            <div className="bg-white w-11/12 h-5/6 rounded-lg shadow-xl p-6 flex flex-col">
              {/* Navigation buttons with top margin */}
              <div className="flex justify-center items-center mt-6 mb-8">
                <button 
                  className="h-12 w-12 rounded-full bg-[#dd2324] flex items-center justify-center mr-4 shadow-md hover:bg-[#c91c1d] transition-all duration-300"
                  onClick={handleRemoveRecord}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  className="h-12 w-12 rounded-full bg-[#dd2324] flex items-center justify-center shadow-md hover:bg-[#c91c1d] transition-all duration-300"
                  onClick={handleAddRecord}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Fixed container */}
              <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden" 
                   style={{ height: '600px', width: '100%' }}>
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-600">Cargando datos del planograma...</p>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-red-500">{error}</p>
                  </div>
                ) : (
                  <div className="h-full w-full relative">
                    {Object.keys(planogramaData).length === 0 ? (
                      <p className="text-gray-600 text-center p-4">No se encontraron datos en el archivo.</p>
                    ) : (
                      <>
                        {/* Set absolute height for scroll area */}
                        <div 
                          className="overflow-y-auto p-4" 
                          style={{ height: '570px' }}
                          ref={scrollContainerRef}
                        >
                          {(() => {
                            const flattenedItems = getFlattenedItems();
                            const totalItems = flattenedItems.length;
                            const itemsToDisplay = flattenedItems.slice(0, displayCount);

                            // Group by charola for display
                            const groupedDisplayItems: Record<string, PlanogramaItem[]> = {};
                          
                            itemsToDisplay.forEach(({charola, item}) => {
                              if (!groupedDisplayItems[charola]) {
                                groupedDisplayItems[charola] = [];
                              }
                              groupedDisplayItems[charola].push(item);
                            });
                          
                            return Object.keys(groupedDisplayItems).sort().map((charola) => (
                              <div key={charola} className="mb-6">
                                <h1 className="text-xl font-bold text-[#dd2324] border-b border-gray-200 pb-2">
                                  Charola {charola}
                                </h1>
                                <ol className="mt-2 pl-6 space-y-1 list-decimal">
                                  {groupedDisplayItems[charola].map((item, index) => (
                                    <li key={index} className="text-gray-700">
                                      <h2 className="text-md font-medium">{item.Nombre}</h2>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ));
                          })()}
                          <div className="mt-4 text-center text-sm text-[#dd2324] sticky bottom-0 bg-white py-3.5">
                            {(() => {
                              const { accumulativeCount, totalFrentes } = calculateAccumulativeCount();
                              return `Mostrando ${accumulativeCount} de ${totalFrentes} artículos`;
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        
        {/* Right section - Updated to show product images based on index */}
        <section className="w-full md:w-1/2 bg-[#fec76f] p-8 flex items-center justify-center min-h-[500px]">
          <div className="bg-white w-11/12 h-5/6 rounded-lg shadow-xl p-6 flex flex-col">
            {/* Navigation buttons - only show when simulation not started */}
            {!isSimulationStarted && (
              <div className="flex justify-center items-center mb-4">
                <button 
                  className="h-12 w-12 rounded-full bg-[#dd2324] flex items-center justify-center mr-4 shadow-md hover:bg-[#c91c1d] transition-all duration-300"
                  onClick={handlePrevEstante}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  className="h-12 w-12 rounded-full bg-[#dd2324] flex items-center justify-center shadow-md hover:bg-[#c91c1d] transition-all duration-300"
                  onClick={handleNextEstante}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
                
            {/* Display area for planogram images */}
            <div className="flex-1 relative w-full flex flex-col">
              {/* Add placeholder div with same height as buttons when in simulation mode */}
              {isSimulationStarted && (
                <div style={{ height: '48px', marginBottom: '16px' }}></div>
              )}
              <div className="flex-1 relative w-full" style={{ height: 'calc(100% - 64px)' }}>
                {/* Background image container - no fixed dimensions */}
                <div className="relative w-full h-full flex items-center justify-center">
                  <div 
                    className="relative" 
                    ref={estanteContainerRef}
                  >
                    {/* Background image - different based on simulation state */}
                    {isSimulationStarted ? (
                      /* Estante background image during simulation - preserve original size */
                      <Image 
                        src={`/Planogramas/Estante_${currentEstante}_vacio.png`}
                        alt={`Planograma ${currentEstante}`}
                        unoptimized={true}
                        width={650}
                        height={500}
                        style={{ width: 'auto', height: 'auto', maxWidth: '100%' }}
                        priority
                        onError={handleImageError}
                      />
                    ) : (
                      /* Pre-simulation image - preserve original size */
                      <Image 
                        src={`/Planogramas/Estante_${estanteNumber}.png`}
                        alt={`Planograma ${estanteNumber}`}
                        unoptimized={true}
                        width={650}
                        height={500}
                        style={{ width: 'auto', height: 'auto', maxWidth: '100%' }}
                        priority
                        onError={handleImageError}
                      />
                    )}
                    
                    {/* Product images overlay - position without forced sizing */}
                    {displayedProducts.map((product, index) => {
                      // Skip rendering products with errored images
                      if (productImageErrors[product.sku]) return null;
                      
                      // During simulation, only show products for current grupo
                      // Before simulation, show products for current estanteNumber
                      const shouldDisplay = isSimulationStarted 
                        ? product.grupo === currentGrupo
                        : product.grupo === estanteNumber;
                    
                      if (!shouldDisplay) return null;
                      
                      // Get position based on bottom-left origin
                      const { x, y } = getBottomLeftPosition(product);
                      
                      return (
                        <div 
                          key={`${product.sku}-${index}`}
                          className="absolute transition-opacity duration-200" 
                          style={{
                            left: `${x}px`,
                            bottom: `${y}px`, // Use bottom instead of top
                          }}
                        >
                          <Image
                            src={`/Product Images/${product.sku}.png`}
                            alt={`Product ${product.sku}`}
                            width={product.w || 35} // Use original width
                            height={product.h || 35} // Use original height
                            unoptimized={true}
                            onError={() => handleProductImageError(product.sku)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="text-center text-sm text-[#dd2324] bg-white py-2 mt-2">
                Planograma {isSimulationStarted ? currentEstante : estanteNumber}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Audio playback status indicator - only show in simulation mode */}
      {isSimulationStarted && (
        <div className="fixed bottom-4 right-4 z-50">
          {audioPlaying ? (
            <div className="bg-[#dd2324] text-white px-4 py-2 rounded-full shadow-lg flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
              Reproduciendo audio...
            </div>
          ) : audioError ? (
            <div className="bg-amber-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              {audioError}
              <button 
                onClick={retryAudioConnection} 
                disabled={isRetryingAudio}
                className={`ml-3 px-2 py-1 bg-white text-amber-600 rounded-md text-sm font-medium ${isRetryingAudio ? 'opacity-50' : 'hover:bg-amber-50'}`}
              >
                {isRetryingAudio ? 'Conectando...' : 'Reintentar'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
