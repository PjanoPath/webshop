import bcrypt from 'bcryptjs';
import { getDb, isUniqueViolation } from './db';

export type Customer = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  buyer_type: 'individual' | 'company';
  company_name: string | null;
  company_ico: string | null;
  company_dic: string | null;
  company_ic_dph: string | null;
  created_at: Date;
};

export type CustomerInput = {
  email: string;
  password: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
};

export async function createCustomer(input: CustomerInput): Promise<Customer | { error: string }> {
  const db = await getDb();
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const { rows } = await db.query(
      `INSERT INTO customers (email, password_hash, name, address, city, postal_code, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.email.toLowerCase().trim(),
        passwordHash,
        input.name.trim(),
        input.address.trim(),
        input.city.trim(),
        input.postal_code.trim(),
        input.phone.trim(),
      ]
    );
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: 'Tento e-mail je už zaregistrovaný.' };
    }
    throw err;
  }
}

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM customers WHERE email = $1', [email.toLowerCase().trim()]);
  return rows[0] ?? null;
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM customers WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function verifyPassword(customer: Customer, password: string): Promise<boolean> {
  return bcrypt.compare(password, customer.password_hash);
}

export type CustomerUpdateInput = {
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  buyer_type: 'individual' | 'company';
  company_name: string;
  company_ico: string;
  company_dic: string;
  company_ic_dph: string;
};

// Switching buyer_type to 'individual' only changes which set is active for future prefill -
// it never erases the company_* columns. Without the CASE guards, saving the profile while
// "Súkromná osoba" is selected would silently wipe out company details typed in earlier,
// forcing them to be retyped from scratch just to switch back.
export async function updateCustomer(id: number, input: CustomerUpdateInput): Promise<Customer> {
  const db = await getDb();
  const isCompany = input.buyer_type === 'company';
  const { rows } = await db.query(
    `UPDATE customers
     SET name = $1, address = $2, city = $3, postal_code = $4, phone = $5,
         buyer_type = $6,
         company_name = CASE WHEN $7 THEN $8 ELSE company_name END,
         company_ico = CASE WHEN $7 THEN $9 ELSE company_ico END,
         company_dic = CASE WHEN $7 THEN $10 ELSE company_dic END,
         company_ic_dph = CASE WHEN $7 THEN $11 ELSE company_ic_dph END
     WHERE id = $12 RETURNING *`,
    [
      input.name.trim(),
      input.address.trim(),
      input.city.trim(),
      input.postal_code.trim(),
      input.phone.trim(),
      input.buyer_type,
      isCompany,
      input.company_name.trim() || null,
      input.company_ico.trim() || null,
      input.company_dic.trim() || null,
      input.company_ic_dph.trim() || null,
      id,
    ]
  );
  return rows[0];
}
