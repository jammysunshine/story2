import { Palette, FileText, Package } from 'lucide-react';

interface MagicGlowProps {
  color?: 'pink' | 'blue' | 'amber' | 'purple' | 'green';
}

export const MagicGlow = ({ color = 'pink' }: MagicGlowProps) => {
  const colorMap: Record<string, string> = {
    pink: 'from-pink-600/50 to-rose-600/50 border-pink-600/70',
    blue: 'from-blue-600/50 to-indigo-600/50 border-blue-600/70',
    amber: 'from-amber-600/50 to-orange-600/50 border-amber-600/70',
    purple: 'from-purple-600/50 to-indigo-600/50 border-purple-600/70',
    green: 'from-green-600/50 to-emerald-600/50 border-green-600/70'
  };

  return (
    <div className="relative w-48 h-48 mx-auto group">
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes magic-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
        }
        @keyframes magic-glow-1 {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.3); opacity: 0.8; }
        }
        @keyframes magic-glow-2 {
          0%, 100% { transform: scale(1.1); opacity: 0.3; }
          50% { transform: scale(1.6); opacity: 0.6; }
        }
        @keyframes magic-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        .animate-magic-float { animation: magic-float 3s ease-in-out infinite; }
        .animate-magic-glow-1 { animation: magic-glow-1 3s ease-in-out infinite; }
        .animate-magic-glow-2 { animation: magic-glow-2 4s ease-in-out infinite; }
        .animate-magic-pulse { animation: magic-pulse 2s ease-in-out infinite; }
      `}} />
      <div className={`absolute inset-0 bg-gradient-to-tr ${colorMap[color]} rounded-full blur-3xl animate-magic-glow-2`} />
      <div className={`absolute inset-0 bg-gradient-to-tr ${colorMap[color]} rounded-full blur-xl animate-magic-glow-1`} />
      <div className={`relative bg-slate-900/90 backdrop-blur-md border-4 ${colorMap[color].split(' ').pop()} w-full h-full rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(0,0,0,0.7)] animate-magic-pulse`}>
        {(color === 'pink' || color === 'blue') ? <Palette className="text-white w-20 h-20 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" /> :
          (color === 'amber' || color === 'green') ? <FileText className="text-white w-20 h-20 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" /> :
            <Package className="text-white w-20 h-20 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" />}
      </div>
    </div>
  );
};
