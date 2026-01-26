export interface BookPage {
  pageNumber: number;
  text: string;
  prompt: string;
  imageUrl?: string;
  url?: string;
}

export interface Book {
  _id?: string;
  bookId?: string;
  title?: string;
  childName?: string;
  pages?: BookPage[];
  status?: string;
  heroBible?: string;
  animalBible?: string;
  finalPrompt?: string;
  photoUrl?: string;
  pdfUrl?: string;
  isDigitalUnlocked?: boolean;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
