import React, { useState } from "react";
import { 
  Camera, 
  Tag, 
  Compass, 
  MapPin, 
  Phone, 
  User as UserIcon, 
  Image as ImageIcon, 
  CheckCircle2, 
  Sparkles, 
  AlertCircle,
  FileText,
  DollarSign,
  Car,
  Layers,
  UploadCloud,
  Check,
  X
} from "lucide-react";
import { User, SparePart, INDIAN_CAR_BRANDS, CAR_PART_CATEGORIES, CAR_SPARE_PARTS_BY_CATEGORY, POPULAR_LOCATIONS } from "../types";
import { createSparePartListing, uploadProductImage } from "../lib/firebase";
import { INDIAN_STATES_AND_DISTRICTS } from "../data/indianLocations";
import MapLocationModal from "./MapLocationModal";
import { useLanguage } from "../lib/LanguageContext";
import { translateDynamic } from "../lib/translations";

interface SellScreenProps {
  currentUser: User;
  onPublishSuccess: (newPart: SparePart) => void;
  parts: SparePart[];
}

// No hardcoded preset images are used here.


export default function SellScreen({ currentUser, onPublishSuccess, parts }: SellScreenProps) {
  const { t, language } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [carBrand, setCarBrand] = useState("");
  const [carModel, setCarModel] = useState("");
  const [category, setCategory] = useState("");
  const [partName, setPartName] = useState("");
  const [condition, setCondition] = useState<"Brand New" | "Like New" | "Used (Good)" | "For Scrap/Spares">("Brand New");
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [contactName, setContactName] = useState(currentUser.name || "");
  const [contactPhone, setContactPhone] = useState(currentUser.phone || "");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  
  // Coordinates State
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [showMapModal, setShowMapModal] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Models list updates dynamically based on the selected brand
  const availableModels = carBrand ? INDIAN_CAR_BRANDS[carBrand] || [] : [];

  // Part names updates dynamically based on the selected category
  const availablePartNames = category ? CAR_SPARE_PARTS_BY_CATEGORY[category] || [] : [];

  // Districts list updates dynamically based on the selected state
  const availableDistricts = selectedState 
    ? INDIAN_STATES_AND_DISTRICTS.find(s => s.state === selectedState)?.districts || [] 
    : [];

  const updateAutoTitle = (brand: string, model: string, part: string) => {
    if (brand && model && part) {
      setTitle(`${brand} ${model} ${part}`);
    }
  };

  const handleBrandChange = (brand: string) => {
    setCarBrand(brand);
    setCarModel(""); // reset model on brand change
    updateAutoTitle(brand, "", partName);
  };

  const handleModelChange = (model: string) => {
    setCarModel(model);
    updateAutoTitle(carBrand, model, partName);
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setPartName(""); // reset part name on category change
    updateAutoTitle(carBrand, carModel, "");
  };

  const handlePartNameChange = (part: string) => {
    setPartName(part);
    updateAutoTitle(carBrand, carModel, part);
  };

  // Handle multiple local image files select (save as local preview base64 data URLs)
  const handleImageFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 6 || uploadedImages.length + files.length > 6) {
      setError("Maximum 6 images allowed.");
      return;
    }

    setError(null);
    const newBase64s: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read local file."));
          reader.readAsDataURL(file);
        });
        newBase64s.push(base64Data);
      }
      setUploadedImages(prev => [...prev, ...newBase64s]);
    } catch (err: any) {
      setError(err.message || "Failed to read local image files.");
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setUploadedImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate form fields (make sure they are not empty)
    if (!title.trim() || !description.trim() || !price || !carBrand || !carModel || !category || !partName || !selectedState || !selectedDistrict || !contactName.trim() || !contactPhone.trim()) {
      setError("Please fill in all listing details including Car Brand, Model, Part Category, Specific Part, and complete Location.");
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Please specify a valid positive price in ₹.");
      return;
    }

    if (uploadedImages.length === 0) {
      setError("Please upload at least one photo of the spare part.");
      return;
    }

    // Prevent duplicate listings
    const isDuplicate = parts.some(
      p => p.sellerId === currentUser.id &&
           p.title.trim().toLowerCase() === title.trim().toLowerCase() &&
           p.price === priceNum &&
           p.description.trim().toLowerCase() === description.trim().toLowerCase()
    );
    if (isDuplicate) {
      setError("You have already published a duplicate listing with these details.");
      return;
    }

    setIsUploading(true);
    setUploadProgress("Initiating upload...");

    try {
      // Upload images to Cloudinary (Wait until every upload finishes)
      const cloudinaryUrls: string[] = [];
      const totalImages = uploadedImages.length;
      for (let i = 0; i < totalImages; i++) {
        const img = uploadedImages[i];
        if (img.startsWith("data:image/")) {
          setUploadProgress(`Uploading photo ${i + 1} of ${totalImages} to Cloudinary...`);
          const uploadedUrl = await uploadProductImage(img);
          cloudinaryUrls.push(uploadedUrl);
        } else {
          // Already a Cloudinary URL or an existing URL
          cloudinaryUrls.push(img);
        }
      }

      setUploadProgress("Creating Firestore document...");
      
      // Create Firestore document
      const savedPart = await createSparePartListing({
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        carBrand,
        carModel,
        category,
        partName,
        condition,
        location: `${selectedDistrict}, ${selectedState}`,
        state: selectedState,
        district: selectedDistrict,
        lat,
        lng,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        whatsappPhone: whatsappPhone.trim(),
        imageUrl: cloudinaryUrls[0],
        imageUrls: cloudinaryUrls,
        sellerId: currentUser.id,
        sellerEmail: currentUser.email
      });

      setUploadProgress(null);
      // Show success
      setShowSuccess(true);
      
      // Navigate Home (Wait for success animation to complete, then trigger navigation callback)
      setTimeout(() => {
        onPublishSuccess(savedPart);
        resetForm();
      }, 1800);

    } catch (err: any) {
      // Show the exact error if upload or Firestore fails. Do not leave the UI stuck on loading.
      setError(err.message || "Failed to publish listing. Please check Firebase configuration.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPrice("");
    setCarBrand("");
    setCarModel("");
    setCategory("");
    setPartName("");
    setCondition("Brand New");
    setSelectedState("");
    setSelectedDistrict("");
    setLat(undefined);
    setLng(undefined);
    setUploadedImages([]);
    setUploadProgress(null);
    setShowSuccess(false);
    setError(null);
  };

  if (showSuccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center animate-fade-in" id="sell-success-container">
        <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <CheckCircle2 size={44} className="animate-bounce" />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight">Part listed successfully</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
          Your car spare part listing is now live on Auto Parts India. Local buyers can now call or message you.
        </p>
        <span className="text-[11px] text-sky-400 mt-6 font-mono animate-pulse">Redirecting to feed...</span>
      </div>
    );
  }

  const userActiveAds = parts.filter(p => 
    p.sellerId === currentUser.id && 
    p.sold !== true && 
    (Date.now() - p.createdAt) <= 90 * 24 * 60 * 60 * 1000
  );
  const isLimitReached = userActiveAds.length >= 5;

  if (isLimitReached) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 text-slate-900 overflow-y-auto h-full" id="sell-screen-container">
        {/* Page Header */}
        <div className="bg-slate-900 text-white px-5 py-5 sticky top-0 z-10 shadow-sm flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold tracking-tight">Sell Car Part</h2>
            <p className="text-[10px] text-slate-400">List high-quality spare parts in India</p>
          </div>
          <Sparkles size={16} className="text-indigo-400" />
        </div>

        <div className="p-6 flex-1 flex flex-col justify-center items-center text-center max-w-md mx-auto my-auto">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 border border-amber-200 rounded-full flex items-center justify-center mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">Active Ad Limit Reached</h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Each user can have a maximum of <strong>5 active ads</strong> at any time. You currently have <strong>5 active ads</strong> running.
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
            To post a new ad, you can mark an existing active ad as sold, delete it permanently, or wait for it to expire after 90 days.
          </p>
          <div className="mt-6 p-4 bg-white border border-slate-150 rounded-2xl w-full text-left">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Your Active Ads:</h4>
            <div className="space-y-2">
              {userActiveAds.map(ad => (
                <div key={ad.id} className="flex gap-2 items-center text-xs">
                  <div className="w-8 h-8 rounded bg-slate-100 overflow-hidden shrink-0">
                    {ad.imageUrl && <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <span className="font-semibold text-slate-700 truncate flex-1">{ad.title}</span>
                  <span className="font-mono font-bold text-slate-900">₹{ad.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900 overflow-y-auto h-full" id="sell-screen-container">
      {/* Page Header */}
      <div className="bg-slate-900 text-white px-5 py-5 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold tracking-tight">Sell Car Part</h2>
          <p className="text-[10px] text-slate-400">List high-quality spare parts in India</p>
        </div>
        <Sparkles size={16} className="text-indigo-400" />
      </div>

      <form onSubmit={handlePublish} className="p-4 space-y-4 pb-24">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-600 flex items-start gap-2 animate-fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Part Image Section */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3 shadow-sm">
          <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
            Spare Part Photos
          </label>

          {uploadProgress && (
            <div className="text-[10px] text-indigo-600 font-semibold bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50 flex items-center gap-1.5 animate-pulse">
              <span className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-ping"></span>
              {uploadProgress}
            </div>
          )}

          {uploadedImages.length > 0 ? (
            <div className="space-y-3">
              {/* Primary Image Cover Preview */}
              <div className="h-44 w-full rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative group">
                <img
                  src={uploadedImages[0]}
                  alt="Primary listing preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2.5 left-2.5 bg-slate-900/70 text-white text-[9px] font-extrabold uppercase tracking-wider py-1 px-2 rounded-md backdrop-blur-md">
                  Cover Photo
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(0)}
                  className="absolute top-2.5 right-2.5 bg-rose-600/90 hover:bg-rose-600 text-white text-[10px] font-bold py-1 px-2.5 rounded-full backdrop-blur-md transition-colors"
                  id="remove-primary-image-btn"
                >
                  Remove
                </button>
              </div>

              {/* Thumbnails Grid for multi-upload */}
              {uploadedImages.length > 1 && (
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {uploadedImages.slice(1).map((imgUrl, index) => (
                    <div key={index} className="aspect-square rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative group">
                      <img
                        src={imgUrl}
                        alt={`Preview ${index + 2}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index + 1)}
                        className="absolute top-1 right-1 bg-slate-900/80 hover:bg-rose-600 text-white rounded-full p-0.5 transition-colors"
                        id={`remove-image-btn-${index + 1}`}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload trigger if under 6 images */}
              {uploadedImages.length < 6 && (
                <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">Add More Photos</span>
                    <span className="text-[10px] text-slate-400">{uploadedImages.length}/6 uploaded</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageFilesChange}
                    className="hidden"
                    id="add-more-image-file-picker"
                  />
                  <label
                    htmlFor="add-more-image-file-picker"
                    className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold hover:bg-slate-50 cursor-pointer shadow-sm"
                  >
                    Choose Files
                  </label>
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center hover:border-indigo-400 transition-colors bg-slate-50/50">
              <UploadCloud size={32} className="text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">Browse or Drag Part Photos</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                Support local file uploads (up to 6 images only).
              </p>
              
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageFilesChange}
                className="hidden"
                id="image-file-picker"
              />
              <label
                htmlFor="image-file-picker"
                className="mt-3 px-4 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[11px] font-semibold hover:bg-slate-50 cursor-pointer shadow-sm active:scale-95 transition-all"
                id="btn-upload-file"
              >
                Choose Local Files
              </label>
            </div>
          )}
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-4 shadow-sm">
          <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
            Item Specifications
          </label>

          {/* Title */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 block">AD TITLE</span>
            <div className="relative">
              <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Maruti Swift Left LED Headlight Assembly"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                required
                id="listing-title"
              />
            </div>
          </div>

          {/* Indian Car Brand and specific Model */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">CAR BRAND</span>
              <div className="relative">
                <Car size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={carBrand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none font-bold"
                  required
                  id="listing-brand"
                >
                  <option value="">Choose Brand</option>
                  {Object.keys(INDIAN_CAR_BRANDS).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">CAR MODEL</span>
              <div className="relative">
                <Layers size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={carModel}
                  disabled={!carBrand}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none font-bold"
                  required
                  id="listing-model"
                >
                  <option value="">Choose Model</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Category selection */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 block">{t("category").toUpperCase()}</span>
            <div className="relative">
              <Compass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none font-bold"
                required
                id="listing-category"
              >
                <option value="">{t("selectCategory")}</option>
                {CAR_PART_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{translateDynamic(cat, language)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Specific Spare Part Selection */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 block">SPECIFIC SPARE PART</span>
            <div className="relative">
              <Compass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={partName}
                disabled={!category}
                onChange={(e) => handlePartNameChange(e.target.value)}
                className="w-full bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none font-bold"
                required
                id="listing-part-name"
              >
                <option value="">Select Specific Spare Part</option>
                {availablePartNames.map((part) => (
                  <option key={part} value={part}>{part}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Condition segmented control */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 block">PART CONDITION</span>
            <div className="grid grid-cols-2 gap-2">
              {(["Brand New", "Like New", "Used (Good)", "For Scrap/Spares"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCondition(opt)}
                  className={`py-2 px-1 text-[11px] font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                    condition === opt
                      ? "bg-indigo-50 border-indigo-500 text-indigo-600 font-extrabold"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                  id={`condition-opt-${opt.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                >
                  {condition === opt && <Check size={11} className="text-indigo-600 shrink-0" />}
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Price and Location */}
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">PRICE (₹ INR)</span>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700 text-xs font-black font-mono">₹</span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 4500"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-8 pr-4 text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono"
                  required
                  id="listing-price"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">STATE</span>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setSelectedDistrict(""); // Reset district
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none font-bold"
                    required
                    id="listing-state"
                  >
                    <option value="">Choose State</option>
                    {INDIAN_STATES_AND_DISTRICTS.map((s) => (
                      <option key={s.state} value={s.state}>{s.state}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">DISTRICT / CITY</span>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  <select
                    value={selectedDistrict}
                    disabled={!selectedState}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none font-bold"
                    required
                    id="listing-district"
                  >
                    <option value="">Choose District</option>
                    {availableDistricts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Map Picker Trigger Button */}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer shadow-sm active:scale-[0.99] ${
                  typeof lat === "number" && typeof lng === "number"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 font-extrabold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
                id="listing-map-picker-trigger"
              >
                <Compass size={14} className={typeof lat === "number" && typeof lng === "number" ? "text-indigo-600 animate-spin-slow" : "text-slate-400"} />
                {typeof lat === "number" && typeof lng === "number" ? (
                  <span>📍 Pin Placed ({lat.toFixed(4)}, {lng.toFixed(4)})</span>
                ) : (
                  <span>Select Shop Location on Map (Optional Pin)</span>
                )}
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 block">AD DESCRIPTION</span>
            <div className="relative">
              <FileText size={15} className="absolute left-3 top-3 text-slate-400" />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specify details like product quality, condition, age, usage history, and compatible variants..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 leading-relaxed"
                required
                id="listing-description"
              />
            </div>
          </div>
        </div>

        {/* Contact Details Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-4 shadow-sm">
          <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
            Seller Contact Info
          </label>

          <div className="grid grid-cols-1 gap-3.5">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">NAME</span>
              <div className="relative">
                <UserIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Seller contact name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  required
                  id="listing-contact-name"
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">CONTACT PHONE</span>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 XXXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  required
                  id="listing-contact-phone"
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">WHATSAPP NUMBER</span>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-emerald-500" />
                <input
                  type="tel"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="+91 98765 XXXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  required
                  id="listing-whatsapp-phone"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isUploading}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3.5 rounded-2xl text-xs tracking-wider uppercase transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          id="listing-submit-btn"
        >
          {isUploading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Post Advertisement</span>
            </>
          )}
        </button>
      </form>

      {/* Map Picker Modal Backdrop */}
      {showMapModal && (
        <MapLocationModal
          initialLat={lat}
          initialLng={lng}
          state={selectedState}
          district={selectedDistrict}
          onConfirm={(selectedLat, selectedLng) => {
            setLat(selectedLat);
            setLng(selectedLng);
          }}
          onClose={() => setShowMapModal(false)}
        />
      )}
    </div>
  );
}
