'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Upload, X, Plus, CheckCircle, AlertCircle, Utensils, Home, Shirt, Trash2, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Store, Product, ProductCategory, StoreCategory } from '@/types';

interface ProductForm {
  name: string; description: string; price: number;
  category_id: string; is_featured: boolean; is_available: boolean;
  prep_time_min: number; spice_level: string;
  property_type: string; bedrooms: number; bathrooms: number; toilets: number;
  area_sqm: number; furnishing: string; location_url: string;
  material: string; gender: string; stock_qty: number;
}

const ic = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none bg-gray-50 focus:bg-white';
const sel = `${ic} appearance-none`;

function EditProductInner() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { user, isVendor, isLoggedIn, loading: al } = useAuth();

  const [store,       setStore]       = useState<Store | null>(null);
  const [product,     setProduct]     = useState<Product | null>(null);
  const [categories,  setCategories]  = useState<ProductCategory[]>([]);
  const [imageFile,   setImageFile]   = useState<File | null>(null);
  const [imagePreview,setImagePreview]= useState('');
  const [sizes,       setSizes]       = useState<string[]>([]);
  const [colors,      setColors]      = useState<string[]>([]);
  const [sizeInput,   setSizeInput]   = useState('');
  const [colorInput,  setColorInput]  = useState('');
  const [fetchLoading,setFetchLoading]= useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [err,         setErr]         = useState('');
  const [notFound,    setNotFound]    = useState(false);
  const [newCatName,  setNewCatName]  = useState('');
  const [addingCat,   setAddingCat]   = useState(false);
  const [showDelete,  setShowDelete]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const { register, handleSubmit, formState:{ errors }, reset } = useForm<ProductForm>();

  useEffect(() => {
    if (al) return;
    if (!isLoggedIn) { router.replace(`/auth/login?next=/vendor/products/${productId}`); return; }
    if (user) fetchData();
  }, [al, isLoggedIn, user, productId]);

  async function fetchData() {
    setFetchLoading(true);
    const { data: s } = await supabase.from('stores').select('*').eq('vendor_id', user!.id).single();
    if (!s) { router.replace('/vendor/setup'); return; }
    setStore(s);

    const { data: p } = await supabase.from('products').select('*').eq('id', productId).eq('store_id', s.id).single();
    if (!p) { setNotFound(true); setFetchLoading(false); return; }
    setProduct(p);
    setImagePreview(p.image_url ?? '');
    setSizes(p.sizes ?? []);
    setColors(p.colors ?? []);

    const { data: c } = await supabase.from('product_categories').select('*').eq('store_id', s.id).order('sort_order');
    setCategories(c ?? []);

    reset({
      name: p.name, description: p.description ?? '', price: p.price,
      category_id: p.category_id ?? '', is_featured: p.is_featured, is_available: p.is_available,
      prep_time_min: p.prep_time_min ?? undefined, spice_level: p.spice_level ?? '',
      property_type: p.property_type ?? '', bedrooms: p.bedrooms ?? undefined,
      bathrooms: p.bathrooms ?? undefined, toilets: p.toilets ?? undefined,
      area_sqm: p.area_sqm ?? undefined, furnishing: p.furnishing ?? '', location_url: p.location_url ?? '',
      material: p.material ?? '', gender: p.gender ?? '', stock_qty: p.stock_qty ?? 0,
    });
    setFetchLoading(false);
  }

  async function addCategory() {
    if (!newCatName.trim() || !store) return;
    setAddingCat(true);
    const { data } = await supabase.from('product_categories').insert([{ store_id: store.id, name: newCatName.trim() }]).select().single();
    if (data) { setCategories(p => [...p, data]); setNewCatName(''); }
    setAddingCat(false);
  }

  async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop();
    const path = `products/${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('africart').upload(path, file, { upsert: true });
    if (error) return null;
    return supabase.storage.from('africart').getPublicUrl(path).data.publicUrl;
  }

  const onSubmit = async (data: ProductForm) => {
    if (!store || !product) return;
    setSubmitting(true); setErr('');
    try {
      let image_url = product.image_url;
      if (imageFile) {
        const uploaded = await uploadImage(imageFile);
        if (uploaded) image_url = uploaded;
      }

      const payload: any = {
        category_id:  data.category_id || null,
        name:         data.name,
        description:  data.description || null,
        price:        Number(data.price),
        image_url,
        is_available: data.is_available,
        is_featured:  data.is_featured,
        updated_at:   new Date().toISOString(),
      };

      if (store.category === 'food') {
        payload.prep_time_min = data.prep_time_min ? Number(data.prep_time_min) : null;
        payload.spice_level   = data.spice_level || null;
      }
      if (store.category === 'real_estate') {
        payload.property_type = data.property_type || null;
        payload.bedrooms      = data.bedrooms ? Number(data.bedrooms) : null;
        payload.bathrooms     = data.bathrooms ? Number(data.bathrooms) : null;
        payload.toilets       = data.toilets ? Number(data.toilets) : null;
        payload.area_sqm      = data.area_sqm ? Number(data.area_sqm) : null;
        payload.furnishing    = data.furnishing || null;
        payload.location_url  = data.location_url || null;
      }
      if (store.category === 'fashion') {
        payload.sizes     = sizes;
        payload.colors    = colors;
        payload.material  = data.material || null;
        payload.gender    = data.gender || null;
        payload.stock_qty = Number(data.stock_qty) || 0;
      }

      const { error } = await supabase.from('products').update(payload).eq('id', productId);
      if (error) throw new Error(error.message);

      setSaved(true);
      setTimeout(() => router.push('/vendor/dashboard'), 1800);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from('products').delete().eq('id', productId);
    router.push('/vendor/dashboard');
  };

  if (al || fetchLoading) return (
    <div className="min-h-screen pt-[64px] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen pt-[64px] flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow border border-gray-100">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-black text-gray-900 mb-2">Item not found</h2>
        <p className="text-gray-500 text-sm mb-5">This item doesn't exist or doesn't belong to your store.</p>
        <Link href="/vendor/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600">← Dashboard</Link>
      </div>
    </div>
  );

  const cat = store?.category as StoreCategory;
  const catLabel = cat === 'food' ? 'Menu Item' : cat === 'real_estate' ? 'Property' : 'Fashion Item';
  const headerGradient = cat === 'food' ? 'from-orange-500 to-red-600' : cat === 'real_estate' ? 'from-amber-500 to-yellow-600' : 'from-rose-500 to-pink-600';
  const btnGradient    = cat === 'food' ? 'bg-gradient-to-r from-orange-500 to-red-600 shadow-orange-200' : cat === 'real_estate' ? 'bg-gradient-to-r from-amber-500 to-yellow-600 shadow-amber-200' : 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-rose-200';

  return (
    <div className="min-h-screen pt-[64px] bg-gray-50">
      <div className={`py-8 text-white bg-gradient-to-r ${headerGradient}`}>
        <div className="max-w-[760px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
              {cat === 'food' ? '🍛' : cat === 'real_estate' ? '🏠' : '👗'}
            </div>
            <div>
              <h1 className="text-2xl font-black">Edit {catLabel}</h1>
              <p className="text-white/70 text-sm">{store?.name}</p>
            </div>
          </div>
          <Link href="/vendor/dashboard" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold text-sm transition-all">
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-[760px] mx-auto px-6 py-8">
        {saved && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 mb-5 rounded-2xl bg-green-50 border border-green-200">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-700 font-semibold text-sm">Saved! Redirecting to dashboard...</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {err && <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3"><AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" /><p className="text-red-600 text-sm font-medium">{err}</p></div>}

          {/* Basic info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-black text-gray-900">{catLabel} Details</h2>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Name *</label>
              <input {...register('name', { required: 'Required' })} type="text" className={ic} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Description</label>
              <textarea {...register('description')} rows={3} className={`${ic} resize-none`} />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Price (₦) *</label>
              <input {...register('price', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} type="number" step="0.01" className={ic} />
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Section / Category</label>
              <div className="flex gap-2">
                <select {...register('category_id')} className={`${sel} flex-1`}>
                  <option value="">No section</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex gap-1">
                  <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    placeholder="New section" className="px-3 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 outline-none bg-gray-50 w-32" />
                  <button type="button" onClick={addCategory} disabled={addingCat || !newCatName.trim()}
                    className="px-3 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input {...register('is_available')} type="checkbox" className="w-4 h-4 accent-orange-500" />
                <span className="text-sm font-semibold text-gray-700">Available for orders</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input {...register('is_featured')} type="checkbox" className="w-4 h-4 accent-orange-500" />
                <span className="text-sm font-semibold text-gray-700">🔥 Featured</span>
              </label>
            </div>
          </div>

          {/* Image */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-black text-gray-900 mb-4">Photo</h2>
            <div className="border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden hover:border-orange-300 transition-colors">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="" className="w-full h-48 object-cover" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(''); }}
                    className="absolute top-3 right-3 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center py-10">
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); } }} />
                  <Upload className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">Click to upload photo</p>
                  <p className="text-xs text-gray-300 mt-1">PNG, JPG · Max 5 MB</p>
                </label>
              )}
            </div>
          </div>

          {/* Food fields */}
          {cat === 'food' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-black text-gray-900 flex items-center gap-2"><Utensils className="w-4 h-4 text-orange-500" />Food Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Prep Time (min)</label>
                  <input {...register('prep_time_min')} type="number" className={ic} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Spice Level</label>
                  <select {...register('spice_level')} className={sel}>
                    <option value="">Not spicy</option>
                    <option value="none">None</option>
                    <option value="mild">Mild 🌶</option>
                    <option value="medium">Medium 🌶🌶</option>
                    <option value="hot">Hot 🌶🌶🌶</option>
                    <option value="extra_hot">Extra Hot 🔥</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Real estate fields */}
          {cat === 'real_estate' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-black text-gray-900 flex items-center gap-2"><Home className="w-4 h-4 text-amber-500" />Property Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Listing Type</label>
                  <select {...register('property_type')} className={sel}>
                    <option value="">Select...</option>
                    <option value="sale">For Sale</option>
                    <option value="rent">For Rent</option>
                    <option value="lease">Lease</option>
                    <option value="shortlet">Shortlet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Furnishing</label>
                  <select {...register('furnishing')} className={sel}>
                    <option value="">Select...</option>
                    <option value="furnished">Furnished</option>
                    <option value="semi_furnished">Semi-Furnished</option>
                    <option value="unfurnished">Unfurnished</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Bedrooms</label>
                  <input {...register('bedrooms')} type="number" className={ic} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Bathrooms</label>
                  <input {...register('bathrooms')} type="number" className={ic} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Toilets</label>
                  <input {...register('toilets')} type="number" className={ic} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Area (m²)</label>
                  <input {...register('area_sqm')} type="number" className={ic} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Google Maps Link</label>
                <input {...register('location_url')} type="url" className={ic} placeholder="https://maps.google.com/..." />
              </div>
            </div>
          )}

          {/* Fashion fields */}
          {cat === 'fashion' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-black text-gray-900 flex items-center gap-2"><Shirt className="w-4 h-4 text-rose-500" />Fashion Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Gender</label>
                  <select {...register('gender')} className={sel}>
                    <option value="">Select...</option>
                    <option value="women">Women</option>
                    <option value="men">Men</option>
                    <option value="unisex">Unisex</option>
                    <option value="kids">Kids</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Material</label>
                  <input {...register('material')} type="text" className={ic} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Stock Qty</label>
                  <input {...register('stock_qty')} type="number" className={ic} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Available Sizes</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {sizes.map(s => (
                    <span key={s} className="flex items-center gap-1 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-full">
                      {s}<button type="button" onClick={() => setSizes(p => p.filter(x => x !== s))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={sizeInput} onChange={e => setSizeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && sizeInput.trim()) { e.preventDefault(); setSizes(p => [...p, sizeInput.trim()]); setSizeInput(''); } }}
                    placeholder="e.g. S, M, L — press Enter" className={`${ic} flex-1`} />
                  <button type="button" onClick={() => { if (sizeInput.trim()) { setSizes(p => [...p, sizeInput.trim()]); setSizeInput(''); } }}
                    className="px-4 py-3 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Available Colors</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {colors.map(c => (
                    <span key={c} className="flex items-center gap-1 px-3 py-1 bg-pink-50 border border-pink-200 text-pink-700 text-sm font-bold rounded-full">
                      {c}<button type="button" onClick={() => setColors(p => p.filter(x => x !== c))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={colorInput} onChange={e => setColorInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && colorInput.trim()) { e.preventDefault(); setColors(p => [...p, colorInput.trim()]); setColorInput(''); } }}
                    placeholder="e.g. Red, Black — press Enter" className={`${ic} flex-1`} />
                  <button type="button" onClick={() => { if (colorInput.trim()) { setColors(p => [...p, colorInput.trim()]); setColorInput(''); } }}
                    className="px-4 py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submit row */}
          <div className="flex justify-between items-center pb-8">
            <button type="button" onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-red-600 border border-red-200 hover:bg-red-50 transition-all">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <div className="flex gap-3">
              <Link href="/vendor/dashboard" className="px-6 py-3 rounded-xl font-bold text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</Link>
              <button type="submit" disabled={submitting}
                className={`flex items-center gap-2 px-8 py-3 text-white rounded-xl font-bold text-sm disabled:opacity-60 shadow-lg ${btnGradient}`}>
                {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>

        {/* Delete confirm */}
        {showDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDelete(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-6 h-6 text-red-500" /></div>
              <h3 className="font-black text-gray-900 text-center mb-2">Delete this {catLabel.toLowerCase()}?</h3>
              <p className="text-gray-500 text-sm text-center mb-5">This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDelete(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-60">
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditProductPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-[64px] flex items-center justify-center"><div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <EditProductInner />
    </Suspense>
  );
}
