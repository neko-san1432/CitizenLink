class Profile {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.role = data.role;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.department = data.department;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }
}

module.exports = Profile;
