import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Star, Calendar, MapPin, Edit2, Trash2, X, ExternalLink, LogOut } from 'lucide-react';
import { supabase, Restaurant } from './lib/supabase';
interface User {
  id: string;
  email?: string;
}
const useGooglePlaces = (inputRef: React.RefObject<HTMLInputElement>) => {
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!inputRef.current || !window.google) return;

    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['restaurant', 'cafe', 'bar', 'food', 'establishment'],
      fields: ['name', 'formatted_address', 'place_id', 'rating', 'photos', 'geometry']
    });

    setAutocomplete(ac);
  }, [inputRef]);

  return autocomplete;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'rating'>('date');
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [formData, setFormData] = useState({
    restaurant_name: '',
    address: '',
    date_visited: new Date().toISOString().split('T')[0],
    dishes_ordered: '',
    rating: 5,
    notes: '',
    google_place_id: '',
    google_rating: 0,
    google_maps_url: '',
    google_photo_url: ''
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const autocomplete = useGooglePlaces(autocompleteInputRef);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadRestaurants();
    }
  }, [user]);

  useEffect(() => {
    if (!autocomplete) return;

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.place_id) return;

      const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 400 }) || '';
      const mapsUrl = `https://maps.google.com/?q=place_id:${place.place_id}`;

      setFormData(prev => ({
        ...prev,
        restaurant_name: place.name || '',
        address: place.formatted_address || '',
        google_place_id: place.place_id || '',
        google_rating: place.rating || 0,
        google_maps_url: mapsUrl,
        google_photo_url: photoUrl
      }));

      setPhotoPreview(photoUrl);
    });
  }, [autocomplete]);
  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
  setUser({ id: session.user.id, email: session.user.email });
} else {
  setUser(null);
}
    setLoading(false);
  };

  const loadRestaurants = async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('date_visited', { ascending: false });

    if (!error && data) {
      setRestaurants(data);
    }
  };

  const handleAuth = async () => {
    setAuthError('');
    
    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword
      });
      
      if (error) {
        setAuthError(error.message);
      } else {
        setUser({ id: data.user.id, email: data.user.email });
        setAuthEmail('');
        setAuthPassword('');
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword
      });
      
      if (error) {
        setAuthError(error.message);
      } else {
        alert('Check your email to confirm your account!');
        setIsLogin(true);
      }
    }
  };

  const handleGoogleAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) {
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRestaurants([]);
  };

  const handleAddRestaurant = async () => {
    if (!user) return;

    let photoUrl = formData.google_photo_url;
    
    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('restaurant-photos')
        .upload(fileName, photoFile);

      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('restaurant-photos')
          .getPublicUrl(fileName);
        photoUrl = publicUrl;
      }
    }

    const restaurantData = {
      ...formData,
      photo_url: photoUrl,
      user_id: user.id
    };

    if (editingRestaurant) {
      const { error } = await supabase
        .from('restaurants')
        .update(restaurantData)
        .eq('id', editingRestaurant.id);
        
      if (!error) {
        loadRestaurants();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('restaurants')
        .insert([restaurantData]);
        
      if (!error) {
        loadRestaurants();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this restaurant visit?')) {
      const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', id);
        
      if (!error) {
        loadRestaurants();
      }
    }
  };

  const resetForm = () => {
    setFormData({
      restaurant_name: '',
      address: '',
      date_visited: new Date().toISOString().split('T')[0],
      dishes_ordered: '',
      rating: 5,
      notes: '',
      google_place_id: '',
      google_rating: 0,
      google_maps_url: '',
      google_photo_url: ''
    });
    setPhotoFile(null);
    setPhotoPreview('');
    setEditingRestaurant(null);
    setShowAddModal(false);
  };

  const startEdit = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setFormData({
      restaurant_name: restaurant.restaurant_name,
      address: restaurant.address || '',
      date_visited: restaurant.date_visited,
      dishes_ordered: restaurant.dishes_ordered,
      rating: restaurant.rating,
      notes: restaurant.notes || '',
      google_place_id: restaurant.google_place_id || '',
      google_rating: restaurant.google_rating || 0,
      google_maps_url: restaurant.google_maps_url || '',
      google_photo_url: restaurant.google_photo_url || ''
    });
    setPhotoPreview(restaurant.photo_url || restaurant.google_photo_url || '');
    setShowAddModal(true);
  };

  const filteredRestaurants = restaurants
    .filter(r => 
      r.restaurant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.dishes_ordered.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(r => filterRating ? r.rating === filterRating : true)
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date_visited).getTime() - new Date(a.date_visited).getTime();
      }
      return b.rating - a.rating;
    });
    if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <span className="text-3xl">🍽️</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">MyMunchLog</h1>
            <p className="text-gray-600">Track your restaurant adventures</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setIsLogin(true); setAuthError(''); }}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                isLogin ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setIsLogin(false); setAuthError(''); }}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                !isLogin ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {authError}
            </div>
          )}

          <div className="space-y-3 mb-4">
            <input
              type="email"
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleAuth}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition mb-3"
          >
            {isLogin ? 'Log In' : 'Sign Up'}
          </button>

          <div className="relative mb-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleAuth}
            className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <span className="text-xl">🍽️</span>
            </div>
            <h1 className="text-xl font-bold text-gray-800">MyMunchLog</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-600 transition"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Visit</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search restaurants or dishes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterRating || ''}
              onChange={(e) => setFilterRating(e.target.value ? Number(e.target.value) : null)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Ratings</option>
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(r => (
                <option key={r} value={r}>{r}★</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'rating')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="date">Latest First</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>
        <div className="grid gap-4">
          {filteredRestaurants.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-3xl">🍴</span>
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">No visits yet</h3>
              <p className="text-gray-500 mb-4">Start logging your restaurant adventures!</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition"
              >
                Add Your First Visit
              </button>
            </div>
          ) : (
            filteredRestaurants.map(restaurant => (
              <div key={restaurant.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition">
                <div className="flex flex-col sm:flex-row">
                  {(restaurant.photo_url || restaurant.google_photo_url) && (
                    <div className="sm:w-48 h-48 sm:h-auto flex-shrink-0">
                      <img
                        src={restaurant.photo_url || restaurant.google_photo_url}
                        alt={restaurant.restaurant_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{restaurant.restaurant_name}</h3>
                        {restaurant.address && (
                          <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                            <MapPin className="w-4 h-4" />
                            {restaurant.address}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(restaurant)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(restaurant.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <div className="flex items-center gap-1">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold text-lg">{restaurant.rating}/10</span>
                      </div>
                      {restaurant.google_rating && restaurant.google_rating > 0 && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <span>Google:</span>
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span>{restaurant.google_rating.toFixed(1)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {new Date(restaurant.date_visited).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-gray-600 font-medium mb-1">Dishes:</p>
                      <p className="text-gray-800">{restaurant.dishes_ordered}</p>
                    </div>

                        {restaurant.notes && (
                        <p className="text-sm text-gray-600 mb-3">{restaurant.notes}</p>
                        )}

                        {restaurant.google_maps_url && (
                        <a
                            href={restaurant.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open in Google Maps
                        </a>
                        )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingRestaurant ? 'Edit Visit' : 'Add New Visit'}
              </h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Restaurant Name *
                </label>
                <input
                  ref={autocompleteInputRef}
                  type="text"
                  value={formData.restaurant_name}
                  onChange={(e) => setFormData({ ...formData, restaurant_name: e.target.value })}
                  placeholder="Start typing to search Google Places..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Type to search or enter manually
                </p>
              </div>

              {formData.address && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Visited *
                  </label>
                  <input
                    type="date"
                    value={formData.date_visited}
                    onChange={(e) => setFormData({ ...formData, date_visited: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Rating (1-10) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What You Ordered *
                </label>
                <textarea
                  value={formData.dishes_ordered}
                  onChange={(e) => setFormData({ ...formData, dishes_ordered: e.target.value })}
                  placeholder="e.g., Margherita Pizza, Caesar Salad"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional thoughts..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPhotoFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setPhotoPreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
                {photoPreview && (
                  <img src={photoPreview} alt="Preview" className="mt-3 w-full h-48 object-cover rounded-lg" />
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRestaurant}
                  className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-semibold"
                >
                  {editingRestaurant ? 'Update Visit' : 'Add Visit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;