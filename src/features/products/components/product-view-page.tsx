import { notFound } from 'next/navigation';
import ProductForm from './product-form';
import { Product } from '@/constants/data';
import { getProductById } from '../products-api';

type TProductViewPageProps = {
  readonly productId: string;
};

export default async function ProductViewPage({
  productId
}: TProductViewPageProps) {
  let product: Product | null = null;
  let pageTitle = 'Create New Product';

  if (productId !== 'new') {
    const data = await getProductById(Number(productId));
    if (!data.success) {
      notFound();
    }
    product = data.product;
    pageTitle = `Edit Product`;
  }

  return <ProductForm initialData={product} pageTitle={pageTitle} />;
}
