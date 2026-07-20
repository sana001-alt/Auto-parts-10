import React, { useState } from "react";
import { 
  Search, 
  MapPin, 
  Filter, 
  Phone, 
  MessageSquare, 
  Calendar, 
  Car, 
  Compass, 
  X, 
  Tag, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  Sparkles,
  Info,
  Layers,
  Heart,
  SlidersHorizontal,
  Plus,
  Maximize2,
  Star,
  ArrowLeft,
  Share2,
  Image as ImageIcon
} from "lucide-react";
import { SparePart, INDIAN_CAR_BRANDS, CAR_PART_CATEGORIES, CAR_SPARE_PARTS_BY_CATEGORY, POPULAR_LOCATIONS, User } from "../types";
import { INDIAN_STATES_AND_DISTRICTS } from "../data/indianLocations";
import { motion, AnimatePresence } from "motion/react";
import ImageGalleryModal from "./ImageGalleryModal";
import { fetchSellerReviews, deleteSparePartListing, updateSparePartListing } from "../lib/firebase";
import SellerReviewsView from "./SellerReviewsView";
import EditListingModal from "./EditListingModal";
import { useLanguage } from "../lib/LanguageContext";
import { translateDynamic } from "../lib/translations";
import LanguageSelector from "./LanguageSelector";
import GMap from "./GMap";

// No fallback categories helper is needed as we only display real uploaded images.

interface HomeScreenProps {
  parts: SparePart[];
  onFavoriteToggle?: (partId: string) => void;
  favorites: string[];
  onStartChat?: (part: SparePart) => void;
  currentUser: User | null;
}

export default function HomeScreen({ parts, onFavoriteToggle, favorites, onStartChat, currentUser }: HomeScreenProps) {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedModel, setSelectedModel] = useState("All Models");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedPartName, setSelectedPartName] = useState("All Parts");
  const [selectedState, setSelectedState] = useState("All States");
  const [selectedDistrict, setSelectedDistrict] = useState("All Districts");
  const [selectedCondition, setSelectedCondition] = useState("All Conditions");
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  
  // Local state for editing and deleting own listing
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSaveListingChanges = async (partId: string, updates: Partial<SparePart>) => {
    try {
      const ok = await updateSparePartListing(partId, updates);
      if (ok) {
        setEditingPart(null);
        setSelectedPart(prev => prev && prev.id === partId ? { ...prev, ...updates } : prev);
      }
    } catch (err: any) {
      setDeleteError(err.message || "Failed to update listing.");
    }
  };
  
  // Local state for toggling advanced filters drawer
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Home screen location selector state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locSearchQuery, setLocSearchQuery] = useState("");
  const [locActiveState, setLocActiveState] = useState<string | null>(null);

  // Seller Rating & Reviews states
  const [sellerRating, setSellerRating] = useState<{ average: number; count: number } | null>(null);
  const [showReviews, setShowReviews] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);

  React.useEffect(() => {
    const updateRating = () => {
      const sId = selectedPart?.sellerId;
      if (sId) {
        fetchSellerReviews(sId).then((revs) => {
          const count = revs.length;
          const average = count > 0 
            ? parseFloat((revs.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1))
            : 0;
          setSellerRating({ average, count });
        });
      } else {
        setSellerRating(null);
      }
    };

    updateRating();
    setDetailImageIndex(0);
    window.addEventListener("autoparts_reviews_updated", updateRating);
    window.addEventListener("storage", updateRating);
    return () => {
      window.removeEventListener("autoparts_reviews_updated", updateRating);
      window.removeEventListener("storage", updateRating);
    };
  }, [selectedPart]);

  // Flat list of all spare part names, brands, and models for suggestions and search
  const ALL_SPARE_PART_NAMES = Object.values(CAR_SPARE_PARTS_BY_CATEGORY).flat();
  const ALL_BRANDS = Object.keys(INDIAN_CAR_BRANDS);
  const ALL_MODELS = Object.values(INDIAN_CAR_BRANDS).flat();

  // Search and Filter Logic
  const filteredParts = parts.filter((part) => {
    const isSold = part.sold === true;
    const isExpired = (Date.now() - part.createdAt) > 90 * 24 * 60 * 60 * 1000;
    if (isSold || isExpired) return false;

    const title = (part.title || "").toLowerCase();
    const description = (part.description || "").toLowerCase();
    const carModel = (part.carModel || "").toLowerCase();
    const carBrand = (part.carBrand || "").toLowerCase();
    const category = (part.category || "").toLowerCase();
    const partName = (part.partName || "").toLowerCase();
    const state = (part.state || "").toLowerCase();
    const district = (part.district || "").toLowerCase();
    const location = (part.location || "").toLowerCase();
    const query = (searchQuery || "").trim().toLowerCase();

    const matchesSearch = !query ? true : (
      title.includes(query) ||
      description.includes(query) ||
      carModel.includes(query) ||
      carBrand.includes(query) ||
      category.includes(query) ||
      partName.includes(query) ||
      state.includes(query) ||
      district.includes(query) ||
      location.includes(query)
    );
    
    const matchesBrand = 
      selectedBrand === "All Brands" || 
      part.carBrand === selectedBrand;
      
    const matchesModel = 
      selectedModel === "All Models" || 
      part.carModel === selectedModel;

    const matchesCategory = 
      selectedCategory === "All Categories" || 
      part.category === selectedCategory;

    const matchesPartName = 
      selectedPartName === "All Parts" || 
      part.partName === selectedPartName || 
      (part.title && part.title.toLowerCase().includes(selectedPartName.toLowerCase()));
      
    const matchesLocation = (() => {
      if (selectedState === "All States" || selectedState === "All India") return true;
      
      const matchesStateField = part.state === selectedState || 
        (!part.state && part.location.toLowerCase().includes(selectedState.toLowerCase()));
      
      if (!matchesStateField) return false;

      if (selectedDistrict === "All Districts") return true;
      return part.district === selectedDistrict || 
        (!part.district && part.location.toLowerCase().includes(selectedDistrict.toLowerCase()));
    })();

    const matchesCondition = 
      selectedCondition === "All Conditions" || 
      part.condition === selectedCondition;

    return matchesSearch && matchesBrand && matchesModel && matchesCategory && matchesPartName && matchesLocation && matchesCondition;
  });

  const trimmedQuery = searchQuery.trim().toLowerCase();
  
  const suggestions: { text: string; type: "Part Name" | "Brand" | "Model" }[] = [];
  
  if (trimmedQuery) {
    // Match brands
    ALL_BRANDS.forEach(brand => {
      if (brand.toLowerCase().includes(trimmedQuery) && !suggestions.some(s => s.text === brand)) {
        suggestions.push({ text: brand, type: "Brand" });
      }
    });
    
    // Match models
    ALL_MODELS.forEach(model => {
      if (model.toLowerCase().includes(trimmedQuery) && !suggestions.some(s => s.text === model)) {
        suggestions.push({ text: model, type: "Model" });
      }
    });

    // Match part names
    ALL_SPARE_PART_NAMES.forEach(name => {
      if (name.toLowerCase().includes(trimmedQuery) && !suggestions.some(s => s.text === name)) {
        suggestions.push({ text: name, type: "Part Name" });
      }
    });
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(price);
  };

  const getRelativeTime = (timestamp: number) => {
    const difference = Date.now() - timestamp;
    const hours = Math.floor(difference / (3600 * 1000));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "Brand New":
        return "bg-emerald-500 text-white border-emerald-600";
      case "Like New":
        return "bg-cyan-500 text-white border-cyan-600";
      case "Used (Good)":
        return "bg-amber-500 text-white border-amber-600";
      case "For Scrap/Spares":
        return "bg-rose-500 text-white border-rose-600";
      default:
        return "bg-slate-500 text-white border-slate-600";
    }
  };

  // Handle brand selection change to sync/reset model
  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel("All Models");
  };

  // Get available models based on selected brand
  const availableModels = selectedBrand !== "All Brands" ? INDIAN_CAR_BRANDS[selectedBrand] || [] : [];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900 h-full relative" id="home-screen-container">
      {/* Search Header */}
      <div className="bg-slate-900 text-white pt-5 pb-4 px-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none py-1">
            <button
              onClick={() => {
                setLocSearchQuery("");
                setLocActiveState(null);
                setShowLocationModal(true);
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-white focus:outline-none cursor-pointer bg-slate-850 hover:bg-slate-800 px-3 py-1.5 rounded-full transition-colors border border-slate-800/80"
              id="header-location-picker-btn"
            >
              <MapPin size={13} className="text-sky-400 shrink-0" />
              <span className="truncate max-w-[180px]" id="selected-location-text">
                {selectedState === "All States" || selectedState === "All India"
                  ? "All India"
                  : selectedDistrict === "All Districts"
                    ? `${selectedState} > All Districts`
                    : `${selectedState} > ${selectedDistrict}`}
              </span>
              <ChevronDown size={11} className="text-slate-400 shrink-0 ml-0.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <LanguageSelector />
            <div className="text-[10px] font-mono bg-sky-500/15 text-sky-400 px-2 py-0.5 rounded border border-sky-400/25 shrink-0">
              C2C INDIA
            </div>
          </div>
        </div>

        {/* Custom Search Input */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              placeholder={t("searchPlaceholder")}
              className="w-full bg-slate-800 border-none rounded-full py-2 pl-9 pr-8 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
              id="search-parts-input"
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setShowSuggestions(false);
                }} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                id="search-clear-btn"
              >
                <X size={14} />
              </button>
            )}

            {/* Auto-suggestions list */}
            {showSuggestions && suggestions.length > 0 && (
              <div 
                className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto"
                id="search-suggestions-dropdown"
              >
                {suggestions.slice(0, 6).map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setSearchQuery(suggestion.text);
                      setShowSuggestions(false);
                      if (suggestion.type === "Brand") {
                        handleBrandChange(suggestion.text);
                      } else if (suggestion.type === "Model") {
                        const brand = Object.keys(INDIAN_CAR_BRANDS).find(b => 
                          INDIAN_CAR_BRANDS[b].includes(suggestion.text)
                        );
                        if (brand) {
                          setSelectedBrand(brand);
                          setSelectedModel(suggestion.text);
                        }
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 transition-colors flex items-center justify-between"
                  >
                    <span>{suggestion.text}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      suggestion.type === "Brand" 
                        ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" 
                        : suggestion.type === "Model" 
                          ? "text-sky-400 bg-sky-500/10 border border-sky-500/20" 
                          : "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20"
                    }`}>
                      {suggestion.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowFiltersModal(true)}
            className={`p-2 rounded-full border transition-all relative ${
              selectedBrand !== "All Brands" || 
              selectedModel !== "All Models" || 
              selectedCategory !== "All Categories" || 
              selectedPartName !== "All Parts" ||
              selectedState !== "All States" ||
              selectedDistrict !== "All Districts" ||
              selectedCondition !== "All Conditions"
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-300"
            }`}
            id="filters-modal-toggle"
            title="Advanced Filters"
          >
            <Filter size={15} />
            {(selectedBrand !== "All Brands" || selectedModel !== "All Models" || selectedCategory !== "All Categories" || selectedPartName !== "All Parts" || selectedState !== "All States" || selectedDistrict !== "All Districts" || selectedCondition !== "All Conditions") && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-slate-900" />
            )}
          </button>
        </div>
      </div>

      {/* Horizontal Category Slider */}
      <div className="bg-white border-b border-slate-100 py-3 px-4 overflow-x-auto whitespace-nowrap flex gap-2 scrollbar-none">
         <button
          onClick={() => {
            setSelectedCategory("All Categories");
            setSelectedPartName("All Parts");
          }}
          className={`inline-block px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            selectedCategory === "All Categories"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          id="category-pill-all"
        >
          {t("allParts")}
        </button>
        {CAR_PART_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedPartName("All Parts");
              }}
              className={`inline-block px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              id={`category-pill-${cat.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {translateDynamic(cat, language)}
            </button>
          );
        })}
      </div>

      {/* Quick brand shortcuts under category slider */}
      <div className="bg-slate-50 border-b border-slate-100 py-2 px-4 overflow-x-auto whitespace-nowrap flex gap-1.5 scrollbar-none">
        <span className="text-[10px] text-slate-400 font-bold uppercase self-center mr-1">Brands:</span>
        <button
          onClick={() => handleBrandChange("All Brands")}
          className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
            selectedBrand === "All Brands"
              ? "bg-slate-900/10 text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          All
        </button>
        {Object.keys(INDIAN_CAR_BRANDS).map((b) => (
          <button
            key={b}
            onClick={() => handleBrandChange(b)}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
              selectedBrand === b
                ? "bg-indigo-50 text-indigo-600 border border-indigo-100 font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Parts Feed list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
        <div className="flex justify-between items-center mb-1">
          <div className="flex flex-col">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              {selectedCategory === "All Categories" ? "RECOMMENDED FOR YOU" : selectedCategory.toUpperCase()}
            </h3>
            {selectedBrand !== "All Brands" && (
              <span className="text-[10px] text-indigo-600 font-medium mt-0.5">
                Fitment: {selectedBrand} {selectedModel !== "All Models" ? `• ${selectedModel}` : ""}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full">
            {filteredParts.length} Parts
          </span>
        </div>

        {filteredParts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-400">
              <Compass size={24} />
            </div>
            <h4 className="text-xs font-extrabold text-slate-800">No spare parts found.</h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
              Try changing the brand, selecting a different category, or resetting all search filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedBrand("All Brands");
                setSelectedModel("All Models");
                setSelectedCategory("All Categories");
                setSelectedPartName("All Parts");
                setSelectedState("All States");
                setSelectedDistrict("All Districts");
                setSelectedCondition("All Conditions");
              }}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              id="reset-filters-btn"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3" id="parts-grid">
            {filteredParts.map((part) => {
              const isFav = favorites.includes(part.id);
              return (
                <div
                  key={part.id}
                  onClick={() => setSelectedPart(part)}
                  className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer relative group"
                  id={`part-card-${part.id}`}
                >
                  {/* Image container clickable for direct fullscreen view */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPart(part);
                      setDetailImageIndex(0);
                      setIsGalleryOpen(true);
                    }}
                    className="h-28 w-full bg-slate-200 relative overflow-hidden group/img cursor-zoom-in"
                    title="Click to view full-screen image gallery"
                  >
                    {part.imageUrl ? (
                      <img
                        src={part.imageUrl}
                        alt={part.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 flex flex-col items-center justify-center text-indigo-400 gap-1 p-2">
                        <ImageIcon size={22} className="text-indigo-400/80 animate-pulse" />
                        <span className="text-[9px] font-bold tracking-wider uppercase opacity-80 text-center line-clamp-2">{part.partName || part.category}</span>
                      </div>
                    )}

                    {/* Interactive hover overlay */}
                    <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="bg-slate-900/85 backdrop-blur-sm p-1.5 rounded-full text-white border border-white/15 scale-90 group-hover/img:scale-100 transition-transform duration-300 shadow-lg">
                        <Maximize2 size={11} className="text-indigo-400" />
                      </div>
                    </div>

                    {part.sold && (
                      <div className="absolute inset-0 bg-slate-950/65 flex items-center justify-center z-10">
                        <span className="text-[10px] font-black tracking-widest text-white bg-rose-600 px-2 py-0.5 rounded uppercase shadow-md">
                          SOLD
                        </span>
                      </div>
                    )}
                    
                    {/* Condition badge */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded shadow-sm border ${getConditionColor(part.condition)}`}>
                        {part.condition.toUpperCase()}
                      </span>
                    </div>

                    {/* Price Tag Overlay */}
                    <div className="absolute bottom-2 left-2 bg-slate-900/95 text-white text-[11px] font-black px-2 py-0.5 rounded shadow-sm font-mono">
                      {formatPrice(part.price)}
                    </div>

                    {/* Favorite Button */}
                    {onFavoriteToggle && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFavoriteToggle(part.id);
                        }}
                        className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all ${
                          isFav 
                            ? "bg-rose-50/95 text-rose-500 border border-rose-100" 
                            : "bg-slate-950/45 text-white hover:bg-slate-950/60 border border-white/10"
                        }`}
                        id={`fav-btn-${part.id}`}
                      >
                        <Heart size={12} fill={isFav ? "currentColor" : "none"} />
                      </button>
                    )}
                  </div>

                  {/* Card Content details */}
                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase truncate">
                          {part.carBrand}
                        </span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="text-[9px] font-bold text-indigo-500 uppercase truncate">
                          {part.carModel}
                        </span>
                      </div>
                      
                      <h4 className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                        {part.title}
                      </h4>
                      <p className="text-[9px] text-slate-400 line-clamp-1 mt-0.5">
                        {part.category}
                      </p>
                    </div>

                    <div className="border-t border-slate-50 pt-2 mt-2 flex items-center justify-between text-[8px] text-slate-400 font-bold">
                      <span className="flex items-center gap-0.5 text-slate-400">
                        <MapPin size={8} className="text-slate-400 shrink-0" />
                        <span className="truncate max-w-[50px]">{part.location}</span>
                      </span>
                      <span>{getRelativeTime(part.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Part Detail Drawer Overlay */}
      <AnimatePresence>
        {selectedPart && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="absolute inset-0 bg-slate-50 z-30 flex flex-col text-slate-900 overflow-hidden"
            id="part-detail-backdrop"
          >
            {/* Custom Toast Alert for sharing link */}
            <AnimatePresence>
              {showShareToast && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 10 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg font-bold flex items-center gap-2 z-[99]"
                >
                  <Sparkles size={14} className="text-amber-400" />
                  <span>Link copied to clipboard!</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sticky Top Header Bar */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-3.5 py-2.5 flex items-center justify-between z-20 shadow-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedPart(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-full transition-all active:scale-95 cursor-pointer text-slate-800"
                  id="close-detail-btn"
                >
                  <ArrowLeft size={22} strokeWidth={2.5} />
                </button>
                <div className="flex flex-col">
                  <span className="font-extrabold text-xs text-slate-900 tracking-wide uppercase">Ad Details</span>
                  <span className="text-[10px] text-slate-400 font-bold font-mono">ID: {selectedPart.id.substring(0, 8).toUpperCase()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Share Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const shareUrl = window.location.origin + "?part=" + selectedPart.id;
                    if (navigator.share) {
                      navigator.share({
                        title: selectedPart.title,
                        text: `Check out this ${selectedPart.carBrand} ${selectedPart.carModel} ${selectedPart.title} on Autoparts India!`,
                        url: shareUrl
                      }).catch(() => {
                        navigator.clipboard.writeText(shareUrl);
                        setShowShareToast(true);
                        setTimeout(() => setShowShareToast(false), 2000);
                      });
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      setShowShareToast(true);
                      setTimeout(() => setShowShareToast(false), 2000);
                    }
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-95 text-slate-700 cursor-pointer"
                  title="Share"
                >
                  <Share2 size={20} />
                </button>

                {/* Heart/Favorite Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onFavoriteToggle) onFavoriteToggle(selectedPart.id);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-95 cursor-pointer text-slate-700"
                  title="Favorite"
                >
                  <Heart
                    size={20}
                    className={favorites.includes(selectedPart.id) ? "fill-red-500 text-red-500 stroke-red-500 animate-pulse" : "text-slate-700"}
                  />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-24 scrollbar-none bg-slate-50">
              {/* Cover Image Carousel */}
              {(() => {
                const imageList: string[] = [];
                if (selectedPart.imageUrls && selectedPart.imageUrls.length > 0) {
                  selectedPart.imageUrls.forEach(url => {
                    if (url && !imageList.includes(url)) {
                      imageList.push(url);
                    }
                  });
                } else if (selectedPart.imageUrl) {
                  imageList.push(selectedPart.imageUrl);
                }

                // Touch swipe handlers
                let touchStartX = 0;

                const handleTouchStartLocal = (e: React.TouchEvent) => {
                  touchStartX = e.touches[0].clientX;
                };

                const handleTouchEndLocal = (e: React.TouchEvent) => {
                  const touchEndX = e.changedTouches[0].clientX;
                  const diffX = touchEndX - touchStartX;
                  if (Math.abs(diffX) > 40) {
                    if (diffX > 0) {
                      // swipe right -> previous image
                      setDetailImageIndex(prev => (prev > 0 ? prev - 1 : imageList.length - 1));
                    } else {
                      // swipe left -> next image
                      setDetailImageIndex(prev => (prev < imageList.length - 1 ? prev + 1 : 0));
                    }
                  }
                };

                return (
                  <div 
                    className="h-80 w-full bg-slate-950 relative cursor-pointer group overflow-hidden select-none touch-pan-y flex items-center justify-center border-b border-slate-200"
                    onTouchStart={handleTouchStartLocal}
                    onTouchEnd={handleTouchEndLocal}
                    onClick={() => setIsGalleryOpen(true)}
                    title="Swipe horizontally or click to view gallery"
                  >
                    <AnimatePresence mode="wait">
                      {imageList[detailImageIndex] ? (
                        <motion.img
                          key={detailImageIndex}
                          src={imageList[detailImageIndex]}
                          alt={selectedPart.title}
                          referrerPolicy="no-referrer"
                          initial={{ opacity: 0.85, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0.85, scale: 0.98 }}
                          transition={{ duration: 0.2 }}
                          className="w-full h-full object-contain max-h-80"
                        />
                      ) : (
                        <div className="w-full h-full min-h-[220px] bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center text-indigo-400 gap-2 p-4">
                          <ImageIcon size={36} className="text-indigo-400/80 animate-pulse" />
                          <span className="text-xs font-bold tracking-wider uppercase opacity-80 text-center">{selectedPart.partName || selectedPart.category}</span>
                        </div>
                      )}
                    </AnimatePresence>

                    {/* Left/Right click arrow buttons for desktop */}
                    {imageList.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailImageIndex(prev => (prev > 0 ? prev - 1 : imageList.length - 1));
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/45 hover:bg-indigo-600 text-white rounded-full transition-all z-10 cursor-pointer shadow-md opacity-0 group-hover:opacity-100 md:opacity-80 flex items-center justify-center"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailImageIndex(prev => (prev < imageList.length - 1 ? prev + 1 : 0));
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/45 hover:bg-indigo-600 text-white rounded-full transition-all z-10 cursor-pointer shadow-md opacity-0 group-hover:opacity-100 md:opacity-80 flex items-center justify-center"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </>
                    )}

                    {/* Progress indicators dots or pills */}
                    {imageList.length > 1 && (
                      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 z-10">
                        {imageList.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailImageIndex(idx);
                            }}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              idx === detailImageIndex ? "w-4 bg-indigo-500" : "w-1.5 bg-white/45"
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Image Counter Badge (OLX style) */}
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-xs text-[11px] font-bold text-white px-2.5 py-1 rounded-md tracking-wider font-mono z-10">
                      {detailImageIndex + 1} / {imageList.length}
                    </div>

                    {/* Gallery hint badge (Top Left) */}
                    <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm text-[10px] font-black tracking-wider text-white px-2.5 py-1.5 rounded-md flex items-center gap-1 border border-white/10 opacity-90 transition-all z-10">
                      <Maximize2 size={10} className="text-indigo-400 animate-pulse" />
                      VIEW FULLSCREEN
                    </div>

                    {selectedPart.sold && (
                      <div className="absolute inset-0 bg-slate-950/65 flex items-center justify-center z-20">
                        <span className="text-xs font-black tracking-widest text-white bg-rose-600 px-4 py-2 rounded-md uppercase shadow-xl border border-rose-500">
                          SOLD OUT
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-3 mt-3">
                {/* Price, Title, Location details */}
                <div className="bg-white p-4 shadow-xs border-y border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-start">
                    <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                      {formatPrice(selectedPart.price)}
                    </span>
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${getConditionColor(selectedPart.condition)}`}>
                      {selectedPart.condition}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 leading-snug tracking-tight">
                    {selectedPart.title}
                  </h3>
                  <div className="h-px bg-slate-100 my-2.5" />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1 font-bold">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      {selectedPart.district || selectedPart.location}, {selectedPart.state || "All India"}
                    </span>
                    <span>
                      {new Date(selectedPart.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short"
                      })}
                    </span>
                  </div>
                </div>

                {/* Key attributes/Specification grid */}
                <div className="bg-white p-4 shadow-xs border-y border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-l-3 border-indigo-600 pl-2">
                    Details & Specifications
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-1">
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Brand</span>
                      <span className="text-xs font-extrabold text-slate-800 mt-0.5">{selectedPart.carBrand}</span>
                    </div>
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Model Compatibility</span>
                      <span className="text-xs font-extrabold text-slate-800 mt-0.5">{selectedPart.carModel}</span>
                    </div>
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Category</span>
                      <span className="text-xs font-extrabold text-slate-800 mt-0.5">{selectedPart.category}</span>
                    </div>
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Condition</span>
                      <span className="text-xs font-extrabold text-slate-800 mt-0.5">{selectedPart.condition}</span>
                    </div>
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">State</span>
                      <span className="text-xs font-extrabold text-slate-800 mt-0.5">{selectedPart.state || "All India"}</span>
                    </div>
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">District</span>
                      <span className="text-xs font-extrabold text-slate-800 mt-0.5">{selectedPart.district || "All Districts"}</span>
                    </div>
                  </div>
                </div>

                {/* Description block */}
                <div className="bg-white p-4 shadow-xs border-y border-slate-100 space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-l-3 border-indigo-600 pl-2">
                    Description
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium pt-1">
                    {selectedPart.description}
                  </p>
                </div>

                {/* Verified Seller info */}
                <div 
                  onClick={() => setShowReviews(true)}
                  className="bg-white p-4 shadow-xs border-y border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-full border border-slate-200/80 flex items-center justify-center text-indigo-600 font-bold text-sm uppercase shadow-inner">
                      {selectedPart.contactName.substring(0, 2)}
                    </div>
                    <div>
                      <span className="text-[9px] text-indigo-600 font-black tracking-widest block uppercase leading-none">Verified Seller</span>
                      <h5 className="text-xs font-black text-slate-800 mt-1">{selectedPart.contactName}</h5>
                      
                      {/* Rating details button */}
                      {sellerRating ? (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <Star size={11} className="fill-current text-amber-500" />
                          <span className="text-[10px] text-slate-500 font-bold">
                            {sellerRating.count > 0 ? `${sellerRating.average} (${sellerRating.count} reviews)` : "New Seller (No reviews)"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Click to view reviews</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </div>

                {/* Map approximate location card */}
                <div className="bg-white p-4 shadow-xs border-y border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-l-3 border-indigo-600 pl-2">
                    Posted In
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                    <MapPin size={14} className="text-indigo-600" />
                    <span>{selectedPart.district || selectedPart.location}, {selectedPart.state || "All India"}</span>
                  </div>
                  <GMap
                    lat={selectedPart.lat}
                    lng={selectedPart.lng}
                    state={selectedPart.state}
                    district={selectedPart.district}
                    height="180px"
                  />
                </div>
              </div>
            </div>

            {/* Sticky Bottom Call / Chat Action Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3 flex items-center gap-3 z-20 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
              {currentUser && selectedPart.sellerId === currentUser.id ? (
                <>
                  <button
                    onClick={() => {
                      setEditingPart(selectedPart);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-md font-black text-xs uppercase tracking-wider shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                    id="edit-own-listing-btn"
                  >
                    Edit Listing
                  </button>
                  <button
                    onClick={async () => {
                      if (window.confirm("Are you sure you want to delete this listing?")) {
                        try {
                          await deleteSparePartListing(selectedPart.id);
                          setSelectedPart(null);
                        } catch (err: any) {
                          setDeleteError(err.message || "Failed to delete listing.");
                        }
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-md font-black text-xs uppercase tracking-wider shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                    id="delete-own-listing-btn"
                  >
                    Delete Listing
                  </button>
                </>
              ) : (
                <>
                  {onStartChat && (
                    <button
                      onClick={() => {
                        if (selectedPart.sold) return;
                        onStartChat(selectedPart);
                        setSelectedPart(null); // Close the detail drawer so the chat window overlay is visible
                      }}
                      disabled={selectedPart.sold}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md font-black text-xs uppercase tracking-wider shadow-xs transition-all active:scale-[0.98] cursor-pointer ${
                        selectedPart.sold
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                          : "bg-teal-600 hover:bg-teal-500 text-white"
                      }`}
                      id="inapp-chat-btn"
                    >
                      <MessageSquare size={14} />
                      {selectedPart.sold ? t("soldOut") : "Chat Now"}
                    </button>
                  )}
                  <a
                    href={`tel:${selectedPart.contactPhone}`}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-md font-black text-xs uppercase tracking-wider shadow-xs transition-all active:scale-[0.98] text-center"
                    id="call-seller-btn"
                  >
                    <Phone size={13} />
                    {t("callSeller")}
                  </a>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seller Reviews View Overlay */}
      <AnimatePresence>
        {showReviews && selectedPart && (
          <SellerReviewsView
            sellerId={selectedPart.sellerId}
            sellerName={selectedPart.contactName}
            currentUser={currentUser}
            onClose={() => setShowReviews(false)}
            currentPart={selectedPart}
          />
        )}
      </AnimatePresence>

      {/* Advanced Filter Drawer */}
      <AnimatePresence>
        {showFiltersModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFiltersModal(false)}
            className="absolute inset-0 bg-black/60 z-30 flex items-end"
            id="filters-backdrop"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-[32px] w-full max-h-[85%] overflow-y-auto p-5 space-y-5 shadow-2xl relative text-slate-900"
              id="filters-modal-body"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <SlidersHorizontal size={16} className="text-indigo-600" />
                  Advanced Filter
                </h3>
                <button
                  onClick={() => setShowFiltersModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full"
                  id="close-filters-btn"
                >
                  <X size={16} />
                </button>
              </div>

              {/* 1. Brand Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  1. Select Car Brand
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All Brands">All Brands (India)</option>
                  {Object.keys(INDIAN_CAR_BRANDS).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* 2. Model Dropdown (Disabled if Brand is All Brands) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  2. Select Specific Model
                </label>
                <select
                  value={selectedModel}
                  disabled={selectedBrand === "All Brands"}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-slate-50 disabled:opacity-55 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All Models">All Models</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {selectedBrand === "All Brands" && (
                  <span className="text-[9px] text-slate-400 font-medium block">Choose a Brand first to view specific models.</span>
                )}
              </div>

              {/* 3. Category Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  3. Part Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedPartName("All Parts");
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All Categories">All Categories</option>
                  {CAR_PART_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 3b. Specific Part Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  3b. Specific Spare Part
                </label>
                <select
                  value={selectedPartName}
                  disabled={selectedCategory === "All Categories"}
                  onChange={(e) => setSelectedPartName(e.target.value)}
                  className="w-full bg-slate-50 disabled:opacity-55 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All Parts">All Parts</option>
                  {(selectedCategory !== "All Categories" ? CAR_SPARE_PARTS_BY_CATEGORY[selectedCategory] || [] : []).map((part) => (
                    <option key={part} value={part}>{part}</option>
                  ))}
                </select>
                {selectedCategory === "All Categories" && (
                  <span className="text-[9px] text-slate-400 font-medium block">Choose a Category first to view specific spare parts.</span>
                )}
              </div>

              {/* 4. Condition Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  4. Part Condition
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {["All Conditions", "Brand New", "Like New", "Used (Good)", "For Scrap/Spares"].map((cond) => (
                    <button
                      key={cond}
                      onClick={() => setSelectedCondition(cond)}
                      className={`py-1.5 px-1 text-[10px] font-bold rounded-xl border text-center transition-all truncate ${
                        selectedCondition === cond
                          ? "bg-indigo-50 border-indigo-500 text-indigo-600 font-black"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                      title={cond}
                    >
                      {cond === "All Conditions" ? "All" : cond}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Cascading Location Filter */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  5. Location (Cascading Filter)
                </span>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 block">STATE</span>
                    <select
                      value={selectedState}
                      onChange={(e) => {
                        setSelectedState(e.target.value);
                        setSelectedDistrict("All Districts");
                      }}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="All States">All India</option>
                      {INDIAN_STATES_AND_DISTRICTS.map((s) => (
                        <option key={s.state} value={s.state}>{s.state}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 block">DISTRICT</span>
                    <select
                      value={selectedDistrict}
                      disabled={selectedState === "All States"}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      className="w-full bg-white disabled:opacity-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="All Districts">All Districts</option>
                      {(INDIAN_STATES_AND_DISTRICTS.find(s => s.state === selectedState)?.districts || []).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedBrand("All Brands");
                    setSelectedModel("All Models");
                    setSelectedCategory("All Categories");
                    setSelectedPartName("All Parts");
                    setSelectedState("All States");
                    setSelectedDistrict("All Districts");
                    setSelectedCondition("All Conditions");
                    setShowFiltersModal(false);
                  }}
                  className="flex-1 py-3 border border-slate-200 text-slate-500 font-bold text-xs rounded-2xl hover:bg-slate-50 transition-all text-center"
                  id="filter-reset-all-btn"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFiltersModal(false)}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl shadow-sm text-center"
                  id="filter-apply-all-btn"
                >
                  Show Results
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Home Location Selector Modal */}
      <AnimatePresence>
        {showLocationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLocationModal(false)}
            className="absolute inset-0 bg-black/60 z-35 flex items-end"
            id="location-selector-backdrop"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-[32px] w-full h-[80%] flex flex-col shadow-2xl relative text-slate-900 overflow-hidden"
              id="location-selector-modal-body"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Select Location
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {selectedState === "All States" ? "All India" : selectedDistrict === "All Districts" ? `${selectedState} > All Districts` : `${selectedState} > ${selectedDistrict}`}
                  </p>
                </div>
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 p-1.5 rounded-full transition-colors"
                  id="close-location-modal-btn"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Search Box */}
              <div className="p-3.5 border-b border-slate-100 shrink-0 bg-white">
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={locSearchQuery}
                    onChange={(e) => {
                      setLocSearchQuery(e.target.value);
                      // Reset active browsing state if search is active
                      if (e.target.value.trim()) {
                        setLocActiveState(null);
                      }
                    }}
                    placeholder="Search states or districts (e.g. Pune, Karnataka)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                    id="location-search-input"
                  />
                  {locSearchQuery && (
                    <button
                      onClick={() => setLocSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Content / Lists */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {locSearchQuery.trim() ? (
                  /* --- SEARCH RESULTS VIEW --- */
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1 mb-2">
                      Search Results
                    </span>

                    {/* All India option if matched */}
                    {("all india".includes(locSearchQuery.trim().toLowerCase()) || "india".includes(locSearchQuery.trim().toLowerCase())) && (
                      <button
                        onClick={() => {
                          setSelectedState("All States");
                          setSelectedDistrict("All Districts");
                          setShowLocationModal(false);
                        }}
                        className="w-full text-left px-3.5 py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between border border-transparent hover:border-slate-100"
                      >
                        <div className="flex items-center gap-2.5">
                          <Compass size={14} className="text-sky-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">All India</span>
                        </div>
                        <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase">Default</span>
                      </button>
                    )}

                    {/* State & District matches */}
                    {(() => {
                      const query = locSearchQuery.trim().toLowerCase();
                      const items: React.ReactNode[] = [];
                      
                      INDIAN_STATES_AND_DISTRICTS.forEach((s) => {
                        // Check state name match
                        if (s.state.toLowerCase().includes(query)) {
                          items.push(
                            <button
                              key={`state-${s.state}`}
                              onClick={() => {
                                // Transition to showing districts for this state
                                setLocActiveState(s.state);
                                setLocSearchQuery(""); // Clear search to show district list directly
                              }}
                              className="w-full text-left px-3.5 py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between border border-transparent hover:border-slate-100"
                            >
                              <div className="flex items-center gap-2.5">
                                <MapPin size={14} className="text-indigo-500 shrink-0" />
                                <span className="text-xs font-bold text-slate-800">{s.state}</span>
                              </div>
                              <span className="text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-mono font-bold uppercase">State</span>
                            </button>
                          );
                        }

                        // Check district matches
                        s.districts.forEach((d) => {
                          if (d.toLowerCase().includes(query)) {
                            items.push(
                              <button
                                key={`dist-${s.state}-${d}`}
                                onClick={() => {
                                  setSelectedState(s.state);
                                  setSelectedDistrict(d);
                                  setShowLocationModal(false);
                                }}
                                className="w-full text-left px-3.5 py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between border border-transparent hover:border-slate-100"
                              >
                                <div className="flex items-center gap-2.5">
                                  <MapPin size={14} className="text-emerald-500 shrink-0" />
                                  <span className="text-xs font-bold text-slate-800">
                                    {s.state} <span className="text-slate-400 font-medium">›</span> {d}
                                  </span>
                                </div>
                                <span className="text-[9px] bg-emerald-50 text-emerald-500 px-1.5 py-0.5 rounded font-mono font-bold uppercase">District</span>
                              </button>
                            );
                          }
                        });
                      });

                      if (items.length === 0 && !("all india".includes(query) || "india".includes(query))) {
                        return (
                          <div className="text-center py-8">
                            <span className="text-xs text-slate-400 font-medium">No states or districts match your search</span>
                          </div>
                        );
                      }

                      return items;
                    })()}
                  </div>
                ) : locActiveState ? (
                  /* --- DISTRICTS LIST FOR ACTIVE STATE --- */
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <button
                        onClick={() => setLocActiveState(null)}
                        className="text-xs font-bold text-sky-500 hover:text-sky-600 flex items-center gap-1"
                        id="loc-back-to-states-btn"
                      >
                        ← Back to States
                      </button>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {locActiveState} Districts
                      </span>
                    </div>

                    {/* All Districts of this State option */}
                    <button
                      onClick={() => {
                        setSelectedState(locActiveState);
                        setSelectedDistrict("All Districts");
                        setShowLocationModal(false);
                      }}
                      className="w-full text-left px-3.5 py-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between border border-transparent hover:border-slate-100"
                    >
                      <div className="flex items-center gap-2.5">
                        <Compass size={14} className="text-indigo-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-800">All Districts in {locActiveState}</span>
                      </div>
                      <span className="text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-mono font-bold uppercase">All Districts</span>
                    </button>

                    {/* List of Districts */}
                    {(INDIAN_STATES_AND_DISTRICTS.find(s => s.state === locActiveState)?.districts || []).map((d) => {
                      const isCurrentlySelected = selectedState === locActiveState && selectedDistrict === d;
                      return (
                        <button
                          key={d}
                          onClick={() => {
                            setSelectedState(locActiveState);
                            setSelectedDistrict(d);
                            setShowLocationModal(false);
                          }}
                          className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors flex items-center justify-between border ${
                            isCurrentlySelected 
                              ? "bg-sky-50 border-sky-100 text-sky-900" 
                              : "border-transparent hover:bg-slate-50 hover:border-slate-100 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <MapPin size={14} className={isCurrentlySelected ? "text-sky-500 shrink-0" : "text-slate-400 shrink-0"} />
                            <span className="text-xs font-bold">{d}</span>
                          </div>
                          {isCurrentlySelected && (
                            <span className="text-[9px] bg-sky-500 text-white px-1.5 py-0.5 rounded font-mono font-bold uppercase">Selected</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* --- DEFAULT STATES LIST --- */
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1 mb-2">
                      All Regions
                    </span>

                    {/* All India default option */}
                    <button
                      onClick={() => {
                        setSelectedState("All States");
                        setSelectedDistrict("All Districts");
                        setShowLocationModal(false);
                      }}
                      className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors flex items-center justify-between border ${
                        selectedState === "All States"
                          ? "bg-sky-50 border-sky-100 text-sky-900"
                          : "border-transparent hover:bg-slate-50 hover:border-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Compass size={14} className={selectedState === "All States" ? "text-sky-500 shrink-0" : "text-slate-400 shrink-0"} />
                        <span className="text-xs font-bold">All India</span>
                      </div>
                      <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase">Default</span>
                    </button>

                    <div className="border-t border-slate-100 my-2"></div>

                    {/* List of States */}
                    {INDIAN_STATES_AND_DISTRICTS.map((s) => {
                      const isStateSelected = selectedState === s.state;
                      return (
                        <button
                          key={s.state}
                          onClick={() => {
                            // Immediately transition to show district list for this state
                            setLocActiveState(s.state);
                          }}
                          className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors flex items-center justify-between border ${
                            isStateSelected 
                              ? "bg-slate-50 border-slate-100 text-indigo-900" 
                              : "border-transparent hover:bg-slate-50 hover:border-slate-100 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <MapPin size={14} className={isStateSelected ? "text-indigo-500 shrink-0" : "text-slate-400 shrink-0"} />
                            <span className="text-xs font-bold">{s.state}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">
                              {s.districts.length} districts
                            </span>
                            <ChevronRight size={12} className="text-slate-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen Image Gallery Modal */}
      <ImageGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        part={selectedPart}
        initialIndex={detailImageIndex}
      />

      {editingPart && (
        <EditListingModal
          part={editingPart}
          onClose={() => setEditingPart(null)}
          onSave={handleSaveListingChanges}
        />
      )}

      {deleteError && (
        <div className="fixed bottom-4 left-4 right-4 bg-rose-600 text-white p-3 rounded-xl shadow-lg z-50 text-xs flex items-center justify-between">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="font-bold underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}
