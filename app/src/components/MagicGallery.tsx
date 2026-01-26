import { Play, ChevronLeft, ChevronRight } from 'lucide-react';

const testimonials = [
  {
    type: 'video',
    thumbnail: '/assets/testimonials/testimonial-1.png',
    title: 'Pure Joy & Wonder',
    user: 'Sarah, Mom of 2',
    duration: '0:45'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-2.png',
    title: 'Boutique Print Quality',
    user: 'Verified Purchase',
    text: 'The hardcover feels premium. A real keepsake for our family library.'
  },
  {
    type: 'video',
    thumbnail: '/assets/testimonials/testimonial-3.png',
    title: 'Laughing Together',
    user: 'Emma, New Parent',
    duration: '1:12'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-4.png',
    title: 'Reading by Fairy Light',
    user: 'David, Proud Dad',
    text: 'My children were mesmerized seeing themselves in the illustrations.'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-5.png',
    title: 'Vibrant AI Art',
    user: 'Art Director',
    text: 'The colors are so vivid on paper. The AI perfectly captured my child.'
  },
  {
    type: 'video',
    thumbnail: '/assets/testimonials/testimonial-6.png',
    title: 'Unboxing Grandma\'s Gift',
    user: 'Grandma Linda',
    duration: '0:58'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-7.png',
    title: 'Bedtime New Favorite',
    user: 'Jessica, Educator',
    text: 'A game-changer for our evening routine. Personalized and magical.'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-8.png',
    title: 'Hugging His Adventure',
    user: 'Liam\'s Family',
    text: 'He won\'t let go of his book! He thinks he is a real superhero now.'
  },
  {
    type: 'video',
    thumbnail: '/assets/testimonials/testimonial-9.png',
    title: 'A Family Moment',
    user: 'The Miller Family',
    duration: '1:30'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-10.png',
    title: 'Magical Sunset Reading',
    user: 'Nature Explorers',
    text: 'Took our WonderStory to the park. It truly felt like a treasure hunt.'
  },
  {
    type: 'video',
    thumbnail: '/assets/testimonials/testimonial-11.png',
    title: 'Adventure Awaits',
    user: 'The Chen Family',
    duration: '0:52'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-12.png',
    title: 'Keepsake Quality',
    user: 'Book Collector',
    text: 'The binding is superb. This is a book that will last for generations.'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-13.png',
    title: 'Toddler Approved',
    user: 'Happy Toddler Mom',
    text: 'Even the youngest explorers love the bright colors and simple stories.'
  },
  {
    type: 'video',
    thumbnail: '/assets/testimonials/testimonial-14.png',
    title: 'The Best Birthday Gift',
    user: 'Birthday Surprise',
    duration: '1:05'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-15.png',
    title: 'Sibling Bonding',
    user: 'Grateful Parent',
    text: 'It brought my kids together in a way no other toy has.'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-16.png',
    title: 'Magical Illustrations',
    user: 'Art Enthusiast',
    text: 'The detail in every page is breathtaking. Truly a work of art.'
  },
  {
    type: 'video',
    thumbnail: '/assets/testimonials/testimonial-17.png',
    title: 'Reading Under the Stars',
    user: 'Star Gazers',
    duration: '0:38'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-18.png',
    title: 'Daily Inspiration',
    user: 'Creative Teacher',
    text: 'A great tool for sparking imagination and love for reading.'
  },
  {
    type: 'image',
    thumbnail: '/assets/testimonials/testimonial-19.png',
    title: 'Family Tradition',
    user: 'Legacy Builder',
    text: 'We are making this a yearly tradition for all our children.'
  },
  {
    type: 'video',
    thumbnail: '/assets/testimonials/testimonial-20.png',
    title: 'Christmas Morning Magic',
    user: 'Holiday Memories',
    duration: '1:45'
  }
];

export function MagicGallery() {
  return (
    <div className="space-y-8 pt-12 pb-20">
      <div className="flex items-center justify-between px-4">
        <div className="space-y-1">
          <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Magic in Action</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real stories from real families</p>
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500"><ChevronLeft size={16} /></div>
          <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-white"><ChevronRight size={16} /></div>
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto px-4 pb-8 no-scrollbar snap-x snap-mandatory">
        {testimonials.map((item, i) => (
          <div key={i} className="min-w-[280px] md:min-w-[320px] aspect-[4/5] bg-slate-900/50 rounded-[2.5rem] border border-white/5 relative overflow-hidden snap-start group cursor-pointer hover:border-primary/30 transition-all">
            <img src={item.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" alt={item.title} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
            
            <div className="absolute inset-0 p-8 flex flex-col justify-end">
              {item.type === 'video' && (
                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Play className="text-white fill-current" size={20} />
                </div>
              )}
              <h4 className="text-lg font-black uppercase tracking-tighter text-white leading-tight mb-1">{item.title}</h4>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">{item.user}</p>
              {item.text && <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 italic">"{item.text}"</p>}
              {item.duration && <span className="text-[8px] font-black text-slate-500 uppercase">{item.duration} MIN CLIP</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
