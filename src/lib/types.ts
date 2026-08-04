[cite: 1]export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      business_hours: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string
        }
        Insert: {
          close_time: string
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time: string
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          reason: string
          session_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason: string
          session_id?: string | null
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string
          session_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          difference: number | null
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          opening_amount: number
          session_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_amount?: number
          session_date?: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_amount?: number
          session_date?: string
          status?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean | null
          color: string
          created_at: string | null
          display_order: number | null
          icon_name: string
          id: string
          name: string
          print_destination: string
          sort_order: number
        }
        Insert: {
          active?: boolean | null
          color?: string
          created_at?: string | null
          display_order?: number | null
          icon_name?: string
          id?: string
          name: string
          print_destination?: string
          sort_order?: number
        }
        Update: {
          active?: boolean | null
          color?: string
          created_at?: string | null
          display_order?: number | null
          icon_name?: string
          id?: string
          name?: string
          print_destination?: string
          sort_order?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          postal_code: string | null
          tax_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          is_takeout: boolean | null
          iva_rate: number
          notes: string | null
          order_id: string | null
          price: number
          print_destination: string
          product_id: string | null
          product_name: string
          quantity: number | null
          status: string | null
          takeaway: boolean
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_takeout?: boolean | null
          iva_rate?: number
          notes?: string | null
          order_id?: string | null
          price?: number
          print_destination?: string
          product_id?: string | null
          product_name: string
          quantity?: number | null
          status?: string | null
          takeaway?: boolean
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_takeout?: boolean | null
          iva_rate?: number
          notes?: string | null
          order_id?: string | null
          price?: number
          print_destination?: string
          product_id?: string | null
          product_name?: string
          quantity?: number | null
          status?: string | null
          takeaway?: boolean
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          covers: number
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          notes: string | null
          order_type: string | null
          paid_at: string | null
          payment_method: string | null
          sent_at: string | null
          status: string | null
          subtotal: number
          table_id: string | null
          table_name: string | null
          tax_total: number
          total: number
          total_amount: number | null
          waiter_id: string | null
          waiter_name: string | null
        }
        Insert: {
          covers?: number
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_type?: string | null
          paid_at?: string | null
          payment_method?: string | null
          sent_at?: string | null
          status?: string | null
          subtotal?: number
          table_id?: string | null
          table_name?: string | null
          tax_total?: number
          total?: number
          total_amount?: number | null
          waiter_id?: string | null
          waiter_name?: string | null
        }
        Update: {
          covers?: number
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_type?: string | null
          paid_at?: string | null
          payment_method?: string | null
          sent_at?: string | null
          status?: string | null
          subtotal?: number
          table_id?: string | null
          table_name?: string | null
          tax_total?: number
          total?: number
          total_amount?: number | null
          waiter_id?: string | null
          waiter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          active: boolean
          created_at: string | null
          destination: string
          id: string
          ip_address: string
          name: string
          port: number
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          destination: string
          id?: string
          ip_address: string
          name: string
          port?: number
        }
        Update: {
          active?: boolean
          created_at?: string | null
          destination?: string
          id?: string
          ip_address?: string
          name?: string
          port?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean | null
          available: boolean
          category_id: string | null
          created_at: string | null
          description: string | null
          image_url: string | null
          id: string
          is_active: boolean | null
          is_takeout_allowed: boolean | null
          iva_rate: number
          name: string
          price: number
          print_destination: string | null
          sort_order: number
          stock_actual: number
        }
        Insert: {
          active?: boolean | null
          available?: boolean
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          image_url?: string | null
          id?: string
          is_active?: boolean | null
          is_takeout_allowed?: boolean | null
          iva_rate?: number
          name: string
          price: number
          print_destination?: string | null
          sort_order?: number
          stock_actual?: number
        }
        Update: {
          active?: boolean | null
          available?: boolean
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          image_url?: string | null
          id?: string
          is_active?: boolean | null
          is_takeout_allowed?: boolean | null
          iva_rate?: number
          name?: string
          price?: number
          print_destination?: string | null
          sort_order?: number
          stock_actual?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string | null
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          party_size: number
          reservation_date: string
          source: string | null
          status: string | null
          table_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string | null
          party_size: number
          reservation_date: string
          source?: string | null
          status?: string | null
          table_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          party_size?: number
          reservation_date?: string
          source?: string | null
          status?: string | null
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          active: boolean
          area: string | null
          created_at: string | null
          current_total: number | null
          id: string
          merged_into: string | null
          name: string | null
          pos_x: number
          pos_y: number
          seats: number
          section: string
          status: string | null
          table_number: string
        }
        Insert: {
          active?: boolean
          area?: string | null
          created_at?: string | null
          current_total?: number | null
          id?: string
          merged_into?: string | null
          name?: string | null
          pos_x?: number
          pos_y?: number
          seats?: number
          section?: string
          status?: string | null
          table_number: string
        }
        Update: {
          active?: boolean
          area?: string | null
          created_at?: string | null
          current_total?: number | null
          id?: string
          merged_into?: string | null
          name?: string | null
          pos_x?: number
          pos_y?: number
          seats?: number
          section?: string
          status?: string | null
          table_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          commercial_name: string | null
          created_at: string | null
          customer_id: string | null
          email: string | null
          hash: string
          id: string
          is_invoice: boolean
          issuer_address: string | null
          issuer_name: string
          iva_breakdown: Json
          nif_emisor: string
          order_id: string | null
          payment_amount: number | null
          payment_change: number | null
          payment_method: string | null
          phone: string | null
          previous_hash: string
          qr_url: string | null
          recipient_address: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_nif: string | null
          recipient_phone: string | null
          rectifies_ticket_id: string | null
          rectifies_ticket_number: string | null
          sequence: number
          serie: string
          subtotal: number
          tax_total: number
          ticket_datetime: string
          ticket_number: string
          ticket_type: string
          total: number
          voided: boolean
          xml_content: string | null
        }
        Insert: {
          commercial_name?: string | null
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          hash: string
          id?: string
          is_invoice?: boolean
          issuer_address?: string | null
          issuer_name: string
          iva_breakdown?: Json
          nif_emisor: string
          order_id?: string | null
          payment_amount?: number | null
          payment_change?: number | null
          payment_method?: string | null
          phone?: string | null
          previous_hash?: string
          qr_url?: string | null
          recipient_address?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_nif?: string | null
          recipient_phone?: string | null
          rectifies_ticket_id?: string | null
          rectifies_ticket_number?: string | null
          sequence: number
          serie?: string
          subtotal?: number
          tax_total?: number
          ticket_datetime: string
          ticket_number: string
          ticket_type?: string
          total?: number
          voided?: boolean
          xml_content?: string | null
        }
        Update: {
          commercial_name?: string | null
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          hash?: string
          id?: string
          is_invoice?: boolean
          issuer_address?: string | null
          issuer_name?: string
          iva_breakdown?: Json
          nif_emisor?: string
          order_id?: string | null
          payment_amount?: number | null
          payment_change?: number | null
          payment_method?: string | null
          phone?: string | null
          previous_hash?: string
          qr_url?: string | null
          recipient_address?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_nif?: string | null
          recipient_phone?: string | null
          rectifies_ticket_id?: string | null
          rectifies_ticket_number?: string | null
          sequence?: number
          serie?: string
          subtotal?: number
          tax_total?: number
          ticket_datetime?: string
          ticket_number?: string
          ticket_type?: string
          total?: number
          voided?: boolean
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_rectifies_ticket_id_fkey"
            columns: ["rectifies_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      waiters: {
        Row: {
          active: boolean
          created_at: string | null
          id: string
          name: string
          pin: string
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          id?: string
          name: string
          pin: string
          role?: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          id?: string
          name?: string
          pin?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_fiscal_ticket: {
        Args: {
          p_commercial_name?: string
          p_email?: string
          p_is_invoice?: boolean
          p_issuer_address: string
          p_issuer_name: string
          p_iva_breakdown: Json
          p_nif_emisor: string
          p_order_id: string
          p_payment_amount: number
          p_payment_change: number
          p_payment_method: string
          p_phone?: string
          p_recipient_address?: string
          p_recipient_email?: string
          p_recipient_name?: string
          p_recipient_nif?: string
          p_recipient_phone?: string
          p_rectifies_ticket_id?: string
          p_rectifies_ticket_number?: string
          p_serie?: string
          p_subtotal: number
          p_tax_total: number
          p_ticket_datetime: string
          p_ticket_type?: string
          p_total: number
        }
        Returns: Json
      }
      decrement_stock: {
        Args: { p_product_id: string; p_qty: number }
        Returns: undefined
      }
      increment_stock: {
        Args: { p_product_id: string; p_qty: number }
        Returns: undefined
      }
      recalc_table_total: { Args: { p_table_id: string }; Returns: number }
      void_ticket:
        | {
            Args: { p_original_ticket_id: string; p_reason?: string }
            Returns: Json
          }
        | {
            Args: { p_original_ticket_id: string; p_settings: Json }
            Returns: Json
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const