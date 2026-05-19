export interface Branch {
  id: string;
  name: string;
  addressText: string;
  deliveryRadiusM: number;
  locationGeog: {
    type: 'Point';
    coordinates: number[]; // [longitude, latitude]
  };
  distanceM?: number;
  brandId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  countryCode: string;
  province: string;
  district: string;
  neighborhood: string;
  street: string;
  buildingNumber: string | null;
  apartmentNumber: string | null;
  postalCode: string | null;
  isActive: boolean;
  logoUrl?: string | null;
  bannerUrls?: string[];
  parameters?: Record<string, unknown> | null;
}
