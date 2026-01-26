import { Sparkles, Wand2, Loader2, Camera, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../UIComponents';
import { MagicGlow } from '../MagicGlow';
import { MagicGallery } from '../MagicGallery';

interface FormData {
  childName: string;
  age: string;
  gender: string;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  animal: string;
  characterStyle: string;
  location: string;
  lesson: string;
  occasion: string;
}

interface Options {
  genders: string[];
  skinTones: string[];
  hairStyles: string[];
  hairColors: string[];
  styles: string[];
  locations: string[];
}

interface Step1HeroProps {
  loading: boolean;
  formData: FormData;
  setFormData: (data: FormData) => void;
  onRandomize: () => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  photoUrl: string;
  setPhotoUrl: (url: string) => void;
  onGenerate: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  options: Options;
  randomAnimals: string[];
  randomLessons: string[];
}

export function Step1Hero({
  loading,
  formData,
  setFormData,
  onRandomize,
  onPhotoUpload,
  isUploading,
  photoUrl,
  setPhotoUrl,
  onGenerate,
  fileInputRef,
  options,
  randomAnimals,
  randomLessons,
}: Step1HeroProps) {
  const renderSelect = (label: string, field: keyof FormData, choices: string[]) => (
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">{label}</label>
      <select
        value={formData[field]}
        onChange={e => setFormData({ ...formData, [field]: e.target.value })}
        className="w-full bg-slate-800 rounded-xl h-12 px-4 outline-none font-bold text-sm border border-transparent focus:border-primary/30 transition-all shadow-sm focus:shadow-lg focus:shadow-primary/10"
      >
        {choices.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="py-20 text-center space-y-10 animate-in zoom-in duration-500">
          <MagicGlow color="pink" />
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Weaving Your Story</h2>
            <p className="text-slate-400 text-lg font-medium italic">"Once upon a time..."</p>
          </div>
          <div className="max-w-xs mx-auto w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-pink-500 to-primary animate-pulse w-full" />
          </div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] animate-pulse">
            Crafting personalized magic
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-4xl font-black uppercase tracking-tighter text-white">The Hero</h2>
        <Button
          variant="outline"
          onClick={onRandomize}
          className="rounded-full border-primary/30 text-primary hover:bg-primary/10 h-10 px-6 text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Surprise Me
        </Button>
      </div>

      <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-2xl space-y-6">
        {/* Magic Photo Scan */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`bg-slate-950/50 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center p-8 text-center group transition-all cursor-pointer relative overflow-hidden ${photoUrl ? 'border-green-500/50' : 'border-white/10 hover:border-primary/30'
            } hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02] transition-transform`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={onPhotoUpload}
            className="hidden"
            accept="image/*"
          />

          {isUploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="animate-spin text-primary mb-4" size={32} />
              <p className="text-[10px] font-black text-white uppercase tracking-widest">Scanning Magic Features...</p>
            </div>
          ) : photoUrl ? (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-green-500 mb-4 shadow-lg shadow-green-500/20">
                <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <h4 className="text-sm font-black text-green-400 uppercase tracking-widest mb-1">Magic Link Established</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Character will sync with this photo</p>
              <button
                onClick={(e) => { e.stopPropagation(); setPhotoUrl(''); }}
                className="mt-4 text-[8px] font-black uppercase text-red-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <Trash2 size={10} /> REMOVE PHOTO
              </button>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg border border-white/5">
                <Camera className="text-slate-400 group-hover:text-primary transition-colors" size={32} />
              </div>
              <h4 className="text-lg font-black text-white uppercase tracking-widest mb-2">Magic Photo Scan</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed max-w-[200px]">Upload a photo to sync your child's features with the AI character.</p>
              <Badge variant="outline" className="mt-4 border-amber-500/30 text-amber-500 text-[8px] font-black uppercase bg-amber-500/5">Enable Character Sync</Badge>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Hero's Name</label>
            <input value={formData.childName} onChange={e => setFormData({ ...formData, childName: e.target.value })} className="w-full bg-slate-800 rounded-xl h-14 px-6 outline-none font-black text-lg focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary/30 shadow-sm focus:shadow-lg focus:shadow-primary/10" placeholder="e.g. Henry" />
          </div>

          {renderSelect('Age', 'age', Array.from({ length: 23 }, (_, i) => (i + 3).toString()))}
          {renderSelect('Gender', 'gender', options.genders)}
          {renderSelect('Skin Tone', 'skinTone', options.skinTones)}
          {renderSelect('Hair Style', 'hairStyle', options.hairStyles)}
          {renderSelect('Hair Color', 'hairColor', options.hairColors)}
          {renderSelect('Animal Friend', 'animal', randomAnimals)}
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-4">
          {renderSelect('Art Style', 'characterStyle', options.styles)}
          {renderSelect('Story Location', 'location', options.locations)}
          {renderSelect('Life Lesson', 'lesson', randomLessons)}
        </div>
      </div>

      <button onClick={onGenerate} disabled={loading} className="w-full h-20 bg-primary text-white rounded-[1.5rem] font-black text-xl shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 hover:shadow-primary/30 hover:scale-[1.02]">
        <Wand2 />
        Write My Story
      </button>

      {/* Magic Gallery Section */}
      <MagicGallery />

      <div className="pb-12 flex justify-center">
        <button
          onClick={() => {
            const sampleBookId = "697736eadd2afbb4f929b2ff";
            window.location.href = `/success?bookId=${sampleBookId}`;
          }}
          className="group flex flex-col items-center gap-3 transition-all active:scale-95"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-lg group-hover:shadow-primary/30">
            <BookOpen size={24} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:text-primary transition-colors">View a Sample Adventure</span>
        </button>
      </div>
    </div>
  );
}
