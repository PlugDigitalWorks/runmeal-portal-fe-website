export interface Address {
  id: string;
  countryCode: string;
  province: string;
  district: string;
  postalCode: string;
  street: string;
  buildingNumber: string;
  apartmentNumber: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAddressDto {
  countryCode: string;
  province: string;
  district: string;
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
