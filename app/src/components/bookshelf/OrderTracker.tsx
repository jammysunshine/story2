import { Package, Palette, ExternalLink } from 'lucide-react';
import type { Book } from '../../types/book';

interface Order {
  _id: string;
  createdAt: string | Date;
  status: string;
  amount: number;
  trackingUrl?: string;
}

interface OrderTrackerProps {
  orders: Order[];
  activeLibraryBooks: Book[];
}

export function OrderTracker({ orders, activeLibraryBooks }: OrderTrackerProps) {
  const hasActiveDeliveries = orders.length > 0 || activeLibraryBooks.length > 0;

  if (!hasActiveDeliveries) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Package className="text-primary w-5 h-5" />
        <h3 className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-500">Active Deliveries</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Show books currently being painted/processed first */}
        {activeLibraryBooks.map((b) => (
          <div key={`proc-${b._id}`} className="bg-slate-900/50 p-6 rounded-[2rem] border border-blue-500/30 flex items-center gap-6 shadow-xl relative overflow-hidden group">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center shrink-0">
              <Palette className="text-blue-400 w-8 h-8 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-blue-500 tracking-wider mb-1">Processing Magic</p>
              <h4 className="text-sm font-bold text-white truncate">{b.title}</h4>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase bg-blue-500/20 text-blue-400 animate-pulse">
                  {b.status === 'printing' ? 'Preparing Print' : 'Painting Images...'}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Show official orders */}
        {orders.map((order) => (
          <div key={order._id} className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 flex items-center gap-6 shadow-xl relative overflow-hidden group hover:border-primary/30 transition-all">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <Package className="text-primary w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Hardcover Storybook</p>
              <h4 className="text-sm font-bold text-white truncate">Ordered {new Date(order.createdAt).toLocaleDateString()}</h4>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${
                  order.status === 'Shipped' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {order.status}
                </span>
                <p className="text-[10px] font-black text-primary">${order.amount.toFixed(2)}</p>
              </div>
            </div>
            {order.trackingUrl && (
              <a 
                href={order.trackingUrl} 
                target="_blank" 
                className="absolute top-4 right-4 text-blue-400 hover:text-blue-300 transition-colors"
                title="Track Shipment"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}