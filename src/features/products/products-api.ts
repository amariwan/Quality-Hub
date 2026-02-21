import { Product } from '@/constants/data';

// Product service stub – replace with real network calls when available

export type ProductFilters = {
  page?: number;
  limit?: number;
  categories?: string;
  search?: string;
};

export type ProductListResponse = {
  success: boolean;
  time: string;
  message: string;
  total_products: number;
  offset: number;
  limit: number;
  products: Product[];
};

export async function getProducts(
  filters: ProductFilters
): Promise<ProductListResponse> {
  const currentTime = new Date().toISOString();
  const offset = ((filters.page ?? 1) - 1) * (filters.limit ?? 10);
  return {
    success: true,
    time: currentTime,
    message: 'stub - no products',
    total_products: 0,
    offset,
    limit: filters.limit ?? 10,
    products: [] as Product[]
  };
}

export type ProductDetailResponse =
  | {
      success: true;
      message: string;
      product: Product;
    }
  | {
      success: false;
      message: string;
    };

export async function getProductById(
  id: number
): Promise<ProductDetailResponse> {
  return {
    success: false,
    message: `no product with id ${id}`
  };
}
