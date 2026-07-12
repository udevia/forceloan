import { useState } from 'react';
import { Camera, MapPin, Save, Loader2 } from 'lucide-react';
import { db } from '../db/db';

export const CustomerForm = ({ initialData, onCancel }: { initialData?: any, onCancel?: () => void }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [dni, setDni] = useState(initialData?.dni || '');
  const [dniType, setDniType] = useState(initialData?.dniType || 'V');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [address, setAddress] = useState(initialData?.address || '');
  
  const [gpsLocation, setGpsLocation] = useState<{lat: number, lng: number} | null>(initialData?.gps_location || null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsError, setGpsError] = useState('');
  
  const [documentImages, setDocumentImages] = useState<string[]>(initialData?.document_images || []);

  const captureGps = () => {
    setLoadingGps(true);
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('El GPS no está soportado en este navegador.');
      setLoadingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLoadingGps(false);
      },
      () => {
        setGpsError('Error obteniendo ubicación. Asegúrate de dar permisos.');
        setLoadingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocumentImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const currentUser = JSON.parse(localStorage.getItem('payload-user') || '{}');
      
      const customerData = {
        name,
        dni,
        dniType,
        email,
        phone,
        address,
        gps_location: gpsLocation || undefined,
        document_images: documentImages.length > 0 ? documentImages : undefined,
        sync_status: 'pending' as const,
      };

      if (initialData?.id) {
        await db.customers.update(initialData.id, customerData);
        alert('Cliente actualizado localmente!');
        if (onCancel) onCancel();
      } else {
        await db.customers.add({
          ...customerData,
          createdBy: currentUser.id,
          created_at: Date.now()
        });
        alert('Cliente guardado localmente!');
        setName(''); setDni(''); setDniType('V'); setEmail(''); setPhone(''); setAddress('');
        setGpsLocation(null); setDocumentImages([]);
      }
    } catch (err) {
      console.error(err);
      alert('Error guardando en la base de datos local');
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-gray-800">{initialData ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}</h3>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
            Cancelar
          </button>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
          <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Ej. Inversiones El Sol" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Documento</label>
            <div className="flex">
              <select value={dniType} onChange={e => setDniType(e.target.value)} className="border border-gray-300 rounded-l p-2 bg-gray-50 focus:ring-blue-500 focus:border-blue-500">
                <option value="V">V</option>
                <option value="J">J</option>
                <option value="E">E</option>
                <option value="G">G</option>
              </select>
              <input required type="text" value={dni} onChange={e => setDni(e.target.value)} className="w-full border-t border-b border-r border-gray-300 rounded-r p-2 focus:ring-blue-500 focus:border-blue-500" placeholder="12345678" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
          <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500" rows={2}></textarea>
        </div>

        {/* Hardware Integrations */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-600 mb-3">Datos de Campo (Opcional)</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* GPS */}
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <MapPin className="w-4 h-4 mr-1 text-red-500" /> Ubicación GPS
                </span>
                <button type="button" onClick={captureGps} disabled={loadingGps} className="text-xs bg-white border border-gray-300 px-2 py-1 rounded shadow-sm hover:bg-gray-100 disabled:opacity-50 flex items-center">
                  {loadingGps ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Capturar
                </button>
              </div>
              {gpsLocation ? (
                <p className="text-xs text-green-600">Capturado: {gpsLocation.lat.toFixed(5)}, {gpsLocation.lng.toFixed(5)}</p>
              ) : (
                <p className="text-xs text-gray-500">{gpsError || 'No capturada'}</p>
              )}
            </div>

            {/* Camera */}
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <Camera className="w-4 h-4 mr-1 text-blue-500" /> Documento (Fachada/RIF)
                </span>
                <label className="text-xs bg-white border border-gray-300 px-2 py-1 rounded shadow-sm hover:bg-gray-100 cursor-pointer">
                  Añadir Fotos
                  <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleImageCapture} />
                </label>
              </div>
              {documentImages.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {documentImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img} alt={`Preview ${idx+1}`} className="h-16 w-16 object-cover rounded border border-gray-300" />
                      <a 
                        href={img} 
                        download={`cliente-${dni || 'nuevo'}-foto-${idx+1}.jpg`}
                        className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded text-[10px] text-center p-1"
                        title="Descargar imagen"
                      >
                        <span>⬇️</span>
                        <span>Bajar</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setDocumentImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar foto"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Sin documentos</p>
              )}
            </div>
          </div>
        </div>

        <button type="submit" className="w-full mt-4 bg-blue-600 text-white font-medium p-3 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors">
          <Save className="w-5 h-5 mr-2" /> {initialData ? 'Actualizar Cliente Offline' : 'Guardar Cliente Offline'}
        </button>
      </form>
    </div>
  );
};
