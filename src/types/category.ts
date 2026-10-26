import { Product } from './product';
import type { Tag } from './tag';

export interface Category {
  id: string;
  name: string;
  image?: string;
  products?: Product[];
  /** The category's product tags; its products inherit them. */
  tags?: Tag[];
}
