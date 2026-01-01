const Database = require("../config/database");
const Department = require("../models/Department");

class DepartmentRepository {

  constructor() {
    this.db = Database.getInstance();
    this.supabase = this.db.getClient();
  }
  async findAll() {
    const { data, error } = await this.supabase
      .from("departments")
      .select("*")
      .order("name");
    if (error) throw error;
    return data.map(dept => new Department(dept));
  }
  async findActive() {
    const { data, error } = await this.supabase
      .from("departments")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data.map(dept => new Department(dept));
  }
  async findById(id) {
    const { data, error } = await this.supabase
      .from("departments")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return new Department(data);
  }
  async findByCode(code) {
    const { data, error } = await this.supabase
      .from("departments")
      .select("*")
      .eq("code", code)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return new Department(data);
  }
  async create(departmentData) {
    const { data, error } = await this.supabase
      .from("departments")
      .insert(departmentData)
      .select()
      .single();
    if (error) throw error;
    return new Department(data);
  }
  async update(id, departmentData) {
    const { data, error } = await this.supabase
      .from("departments")
      .update({
        ...departmentData,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return new Department(data);
  }
  async delete(id) {
    const { error } = await this.supabase
      .from("departments")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return true;
  }
  async softDelete(id) {
    return this.update(id, { is_active: false });
  }
  async checkCodeExists(code, excludeId = null) {
    let query = this.supabase
      .from("departments")
      .select("id")
      .eq("code", code);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data.length > 0;
  }
}

module.exports = DepartmentRepository;
