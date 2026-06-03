export interface Address {
  id: string;
  countryCode: string;
  province: string;
  district: string;
  phoneE164?: string | null;
  postalCode: string;
  street: string;
  buildingNumber: string;
  apartmentNumber: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  locationGeog?: {
    type: string;
    coordinates: number[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAddressDto {
  countryCode: string;
  province: string;
  district: string;
  phoneE164?: string;
  postalCode: string;
  street: string;
  buildingNumber: string;
  apartmentNumber: string;
  latitude: number;
  longitude: number;
  isActive?: boolean;
}

export interface UpdateAddressDto extends Partial<CreateAddressDto> {
  isActive?: boolean;
}
