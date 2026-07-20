import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Compass, Search, Loader2, Navigation, ZoomIn, ZoomOut } from "lucide-react";
import { getApproxCoordinates, LatLng } from "../utils/locationHelper";

interface GMapProps {
  lat?: number;
  lng?: number;
  state?: string;
  district?: string;
  interactive?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
  height?: string;
  className?: string;
}

export default function GMap({
  lat,
  lng,
  state,
  district,
  interactive = false,
  onLocationSelect,
  height = "200px",
  className = ""
}: GMapProps) {
  const [coords, setCoords] = useState<LatLng>({ lat: 28.6139, lng: 77.2090 });
  const [address, setAddress] = useState<string>("");
  const [addressLoading, setAddressLoading] = useState<boolean>(false);
  
  // Place search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locatingUser, setLocatingUser] = useState<boolean>(false);

  // Leaflet map and marker refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Resolve coordinate changes or fallback location
  useEffect(() => {
    if (
      lat !== undefined &&
      lat !== null &&
      lng !== undefined &&
      lng !== null &&
      lat !== 0 &&
      lng !== 0 &&
      typeof lat === "number" &&
      typeof lng === "number" &&
      !isNaN(lat) &&
      !isNaN(lng)
    ) {
      setCoords({ lat, lng });
    } else {
      const approx = getApproxCoordinates(state, district);
      setCoords(approx);
    }
  }, [lat, lng, state, district]);

  // Handle reverse geocoding to display readable address
  useEffect(() => {
    const fetchAddress = async () => {
      if (!coords.lat || !coords.lng) return;
      setAddressLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`,
          {
            headers: {
              "Accept-Language": "en",
              "User-Agent": "AutoPartsMarketplaceApp/1.0"
            }
          }
        );
        const data = await response.json();
        if (data && data.display_name) {
          setAddress(data.display_name);
        } else {
          setAddress("Unknown Address");
        }
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
        setAddress("Address location found");
      } finally {
        setAddressLoading(false);
      }
    };

    fetchAddress();
  }, [coords.lat, coords.lng]);

  // Initialize and update the Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Define custom styled pulsing marker icon using Tailwind CSS
    const customMarkerIcon = L.divIcon({
      html: `
        <div class="relative flex flex-col items-center animate-fade-in">
          <span class="absolute inline-flex h-10 w-10 rounded-full bg-indigo-500/30 animate-ping"></span>
          <div class="bg-indigo-600 border border-indigo-400 p-2 rounded-full shadow-lg text-white relative z-10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>
      `,
      className: "custom-leaflet-marker",
      iconSize: [40, 40],
      iconAnchor: [20, 36],
    });

    if (!mapRef.current) {
      // Create new Leaflet map instance
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([coords.lat, coords.lng], interactive ? 13 : 11);

      // Add OpenStreetMap tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        crossOrigin: true
      }).addTo(map);

      // Add marker to map
      const marker = L.marker([coords.lat, coords.lng], {
        icon: customMarkerIcon
      }).addTo(map);

      // Add click handler for interactive mapping
      if (interactive && onLocationSelect) {
        map.on("click", (e: L.LeafletMouseEvent) => {
          const { lat: clickLat, lng: clickLng } = e.latlng;
          const newLat = parseFloat(clickLat.toFixed(6));
          const newLng = parseFloat(clickLng.toFixed(6));
          setCoords({ lat: newLat, lng: newLng });
          onLocationSelect(newLat, newLng);
        });
      }

      mapRef.current = map;
      markerRef.current = marker;

      // Invalidate size shortly after load to guarantee correct layout in tabs/modals
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    } else {
      // Smoothly pan and move marker when coordinates update externally
      mapRef.current.setView([coords.lat, coords.lng], mapRef.current.getZoom());
      if (markerRef.current) {
        markerRef.current.setLatLng([coords.lat, coords.lng]);
      }
    }
  }, [coords.lat, coords.lng, interactive, onLocationSelect]);

  // Clean up Leaflet map instance on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Handle location searching (Nominatim API query)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=in`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "AutoPartsMarketplaceApp/1.0"
          }
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        const searchLat = parseFloat(result.lat);
        const searchLng = parseFloat(result.lon);
        
        setCoords({ lat: searchLat, lng: searchLng });
        if (onLocationSelect) {
          onLocationSelect(searchLat, searchLng);
        }
        
        // Pan map smoothly to the search location
        if (mapRef.current) {
          mapRef.current.setView([searchLat, searchLng], 14);
        }
      } else {
        setSearchError("No locations found in India.");
      }
    } catch (err) {
      console.error("Place search failed:", err);
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle geolocating current user location
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setSearchError("Geolocation is not supported by your browser.");
      return;
    }

    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = parseFloat(position.coords.latitude.toFixed(6));
        const userLng = parseFloat(position.coords.longitude.toFixed(6));
        
        setCoords({ lat: userLat, lng: userLng });
        if (onLocationSelect) {
          onLocationSelect(userLat, userLng);
        }

        if (mapRef.current) {
          mapRef.current.setView([userLat, userLng], 15);
        }
        setLocatingUser(false);
      },
      (error) => {
        console.error("Error geolocating user:", error);
        setSearchError("Could not retrieve current location.");
        setLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div 
      className={`relative rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-950 flex flex-col shadow-xl ${className}`}
      style={{ height }}
      id="leaflet-osm-map-container"
    >
      {/* Real Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[140px] relative z-0" />

      {/* Place Search Overlay (Interactive Only) */}
      {interactive && (
        <form 
          onSubmit={handleSearch}
          className="absolute top-3 left-3 right-3 z-[1000] flex gap-2"
          id="map-search-form"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search Indian cities, areas, pincodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/95 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 rounded-xl py-2 pl-3 pr-10 text-xs text-white placeholder-slate-400 focus:outline-hidden shadow-lg backdrop-blur-md transition-all font-semibold"
            />
            {searchLoading ? (
              <Loader2 size={14} className="absolute right-3 top-2.5 text-indigo-400 animate-spin" />
            ) : (
              <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
            )}
          </div>
          <button
            type="submit"
            disabled={searchLoading}
            className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg flex items-center justify-center min-w-[70px]"
          >
            Search
          </button>
        </form>
      )}

      {/* Place Search Error Overlay */}
      {searchError && (
        <div className="absolute top-14 left-3 right-3 z-[1000] bg-rose-500/90 border border-rose-500 text-white text-[10px] py-1.5 px-3 rounded-lg shadow-md font-bold backdrop-blur-sm animate-bounce">
          ⚠️ {searchError}
        </div>
      )}

      {/* Map Control Buttons: Zoom In, Zoom Out, Locate Me (Only when interactive) */}
      {interactive && (
        <div className="absolute right-3 top-16 z-[1000] flex flex-col gap-2">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            className="w-9 h-9 bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-white shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="w-9 h-9 bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-white shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locatingUser}
            className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 rounded-xl text-white shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title="Locate Me"
          >
            {locatingUser ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Navigation size={16} />
            )}
          </button>
        </div>
      )}

      {/* Active Coordinate Display */}
      <div className="absolute top-3 right-3 bg-slate-900/90 border border-slate-800/80 px-2.5 py-1.5 rounded-xl font-mono text-[9px] text-slate-300 shadow-md flex items-center gap-1.5 backdrop-blur-sm z-[999]">
        <Compass size={11} className="text-indigo-400 animate-spin-slow" />
        <span>LAT: {coords.lat.toFixed(4)}</span>
        <span className="text-slate-600">|</span>
        <span>LNG: {coords.lng.toFixed(4)}</span>
      </div>

      {/* Dynamic Reverse Geocoded Address Bar */}
      <div className="absolute bottom-3 left-3 right-3 bg-slate-900/95 border border-slate-800/80 px-3 py-2 rounded-2xl shadow-xl backdrop-blur-md text-left z-[999] flex items-center gap-2 max-h-[60px] overflow-hidden">
        <div className="bg-indigo-500/15 p-1.5 rounded-lg text-indigo-400 shrink-0">
          <MapPin size={12} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[8px] font-black tracking-widest text-indigo-400 uppercase leading-none block">
            {addressLoading ? "GEOLOCATING ADDRESS..." : "SELECTED LOCATION"}
          </span>
          <span className="text-[10px] font-bold text-slate-100 mt-0.5 block truncate leading-tight">
            {addressLoading ? "Fetching details from OpenStreetMap..." : address || "Locating coordinates..."}
          </span>
        </div>
      </div>
    </div>
  );
}
