import { Product } from './product';

export interface Category {
  id: string;
  name: string;
  image?: string;
  products?: Product[];
}
