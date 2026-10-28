export interface Address {
  id: string;
  countryCode: string;
  province: string;
  district: string;
  phoneE164?: string | null;
  postalCode: string;
  /** Both address lines, joined with ", ". */
  street: string;
  /** Only on older rows; new addresses keep the number in `street`. */
  buildingNumber: string | null;
  /** Free-text note for the courier ("Doorbell broken, please call"); null when none. */
  note?: string | null;
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
  /** `null` drops a number an older row kept apart from `street`. */
  buildingNumber?: string | null;
  /** At most 500 characters; "" clears it. */
  note?: string;
  latitude: number;
  longitude: number;
  isActive?: boolean;
}

export interface UpdateAddressDto extends Partial<CreateAddressDto> {
  isActive?: boolean;
}
