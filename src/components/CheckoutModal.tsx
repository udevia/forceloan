import React, { useState } from 'react';
import { db } from '../db/db';
import { Camera, X, Plus, Trash2, CheckCircle, CreditCard, Banknote } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

interface CheckoutModalProps {
  totalUsd: number;
  onClose: () => void;
  onSubmit: (orderData: any) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ totalUsd, onClose, onSubmit }) => {
  const [isCredit, setIsCredit] = useState(true);
  
  // Datos de pagos
  const [payments, setPayments] = useState<any[]>([]);
  
  // Formulario temporal
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [currentCurrency, setCurrentCurrency] = useState<'USD' | 'VES'>('USD');
  const [currentRef, setCurrentRef] = useState('');
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray()) || [];
  const exchangeRecord = useLiveQuery(() => db.exchange.toArray());
  const exchangeRate = exchangeRecord && exchangeRecord.length > 0 ? exchangeRecord[0].price : 1;
  const totalBs = Number((totalUsd * exchangeRate).toFixed(2));

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        setCurrentImage(compressedBase64);
      } catch (err) {
        console.error('Error comprimiendo imagen', err);
      }
    }
  };

  const addPayment = () => {
    if (!currentPaymentMethod) return alert('Selecciona un método de pago');
    if (!currentAmount || Number(currentAmount) <= 0) return alert('Ingresa un monto válido');
    
    const methodInfo = paymentMethods.find(p => p.id === currentPaymentMethod);
    if (!methodInfo) return;

    if (methodInfo.requiresBankInfo && currentRef.length < 4) {
      return alert('Debes ingresar una referencia bancaria válida (mínimo 4 dígitos)');
    }

    setPayments([...payments, {
      id: Date.now().toString(),
      paymentGateway: currentPaymentMethod,
      name: methodInfo.name,
      amount: Number(currentAmount),
      currency: currentCurrency,
      requiresBankInfo: methodInfo.requiresBankInfo,
      requiresBills: methodInfo.requiresBills,
      transaction: currentRef,
      receiptBase64: currentImage
    }]);

    // Reset temporal form
    setCurrentAmount('');
    setCurrentRef('');
    setCurrentImage(null);
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const calculateTotalPaidUsd = () => {
    return payments.reduce((acc, p) => {
      if (p.currency === 'VES') return acc + (p.amount / exchangeRate);
      return acc + p.amount;
    }, 0);
  };

  const handleSubmit = () => {
    if (!isCredit) {
      const paidUsd = calculateTotalPaidUsd();
      // Validar con una tolerancia de 0.10 centavos
      if (paidUsd < totalUsd - 0.10) {
        return alert(`Pago insuficiente. Has abonado $${paidUsd.toFixed(2)} de $${totalUsd.toFixed(2)}`);
      }
    }

    const orderData = {
      is_credit: isCredit,
      exchangeRate,
      totalBs,
      payment_cash: isCredit ? [] : payments.filter(p => !p.requiresBankInfo).map(p => ({
        amount: p.amount,
        currency: p.currency,
        paymentGateway: p.paymentGateway
      })),
      bank_info: isCredit ? [] : payments.filter(p => p.requiresBankInfo).map(p => ({
        transaction: p.transaction,
        transmitter: 'N/A', // Se asume del método
        amount: p.currency === 'VES' ? p.amount : p.amount * exchangeRate, // Bank Info siempre en VES según esquema
        paymentGateway: p.paymentGateway,
        receiptBase64: p.receiptBase64
      }))
    };

    onSubmit(orderData);
  };

  const methodObj = paymentMethods.find(p => p.id === currentPaymentMethod);
  const paidUsd = calculateTotalPaidUsd();
  const remainingUsd = Math.max(0, totalUsd - paidUsd);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <h2 className="font-bold text-gray-800 text-lg">Finalizar Pedido</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Resumen */}
        <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
          <div>
            <p className="text-indigo-200 text-sm">Total a pagar</p>
            <p className="text-2xl font-black">${totalUsd.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-sm">Tasa: Bs. {exchangeRate}</p>
            <p className="text-lg font-bold">Bs. {totalBs.toFixed(2)}</p>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Tipo de Venta */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Venta</label>
            <div className="flex space-x-2">
              <button 
                onClick={() => setIsCredit(true)}
                className={`flex-1 py-3 px-2 flex items-center justify-center rounded-lg border-2 font-bold transition-all ${isCredit ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                <Banknote className="w-5 h-5 mr-2" /> Crédito
              </button>
              <button 
                onClick={() => setIsCredit(false)}
                className={`flex-1 py-3 px-2 flex items-center justify-center rounded-lg border-2 font-bold transition-all ${!isCredit ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                <CreditCard className="w-5 h-5 mr-2" /> Contado
              </button>
            </div>
          </div>

          {/* Formulario de Contado */}
          {!isCredit && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Agregar Pago</h3>
                <span className="text-sm font-bold text-red-500">Resta: ${remainingUsd.toFixed(2)}</span>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                <select 
                  value={currentPaymentMethod}
                  onChange={(e) => setCurrentPaymentMethod(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecciona Método de Pago</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>

                <div className="flex space-x-2">
                  <input 
                    type="number" 
                    placeholder="Monto"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                  />
                  <select 
                    value={currentCurrency}
                    onChange={(e) => setCurrentCurrency(e.target.value as any)}
                    className="w-24 p-2 border border-gray-300 rounded bg-white"
                  >
                    <option value="USD">USD</option>
                    <option value="VES">VES</option>
                  </select>
                </div>

                {methodObj?.requiresBankInfo && (
                  <>
                    <input 
                      type="text" 
                      placeholder="Referencia (Ej: 123456)"
                      value={currentRef}
                      onChange={(e) => setCurrentRef(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                    />
                    
                    <div className="flex items-center space-x-2 mt-2">
                      <label className="flex-1 flex items-center justify-center p-2 border border-dashed border-gray-400 rounded bg-white text-gray-600 hover:bg-gray-50 cursor-pointer">
                        <Camera className="w-4 h-4 mr-2 text-blue-500" /> 
                        {currentImage ? 'Cambiar Foto' : 'Capturar Comprobante'}
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageCapture} />
                      </label>
                      {currentImage && (
                        <div className="w-10 h-10 border border-gray-300 rounded overflow-hidden">
                          <img src={currentImage} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </>
                )}

                <button 
                  onClick={addPayment}
                  className="w-full bg-gray-800 text-white p-2 rounded font-bold hover:bg-gray-700 flex justify-center items-center"
                >
                  <Plus className="w-4 h-4 mr-1" /> Añadir Pago
                </button>
              </div>

              {/* Lista de pagos añadidos */}
              {payments.length > 0 && (
                <ul className="space-y-2 mt-4">
                  {payments.map(p => (
                    <li key={p.id} className="flex justify-between items-center p-2 border border-green-200 bg-green-50 rounded text-sm">
                      <div>
                        <p className="font-bold text-gray-800">{p.name}</p>
                        {p.transaction && <p className="text-xs text-gray-500">Ref: {p.transaction}</p>}
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-green-700">{p.amount} {p.currency}</span>
                        <button onClick={() => removePayment(p.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <button 
            onClick={handleSubmit}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center shadow-lg transition-colors"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Guardar Pedido Localmente
          </button>
        </div>
      </div>
    </div>
  );
};
