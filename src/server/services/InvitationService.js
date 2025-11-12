const crypto = require('crypto');
const InvitationTokenRepository = require('../repositories/InvitationTokenRepository');

class InvitationService {

  constructor() {
    this.invites = new InvitationTokenRepository();
  }
  generateTokenString() {
    return crypto.randomBytes(32).toString('hex');
  }
  async createInvitation({ createdBy, role, departmentId = null, employeeIdRequired = true, maxUses = 1, expiresInHours = 1 }) {
    if (!createdBy) throw new Error('createdBy is required');
    if (!role) throw new Error('role is required');
    const token = this.generateTokenString();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
    const tokenData = {
      token,
      created_by: createdBy,
      role,
      department_id: departmentId,
      employee_id_required: Boolean(employeeIdRequired),
      max_uses: Math.max(1, Number(maxUses) || 1),
      uses: 0,
      expires_at: expiresAt,
      active: true,
      created_at: new Date().toISOString()
    };
    const created = await this.invites.createToken(tokenData);
    return created;
  }
  async validateInvitation(token) {
    if (!token) throw new Error('token is required');
    const invite = await this.invites.getToken(token);
    const now = Date.now();
    if (!invite) throw new Error('Invitation not found');
    if (!invite.active) throw new Error('Invitation inactive');
    if (invite.uses >= invite.max_uses) throw new Error('Invitation max uses reached');
    if (new Date(invite.expires_at).getTime() < now) throw new Error('Invitation expired');
    return invite;
  }
  async consumeInvitation(token) {
    const invite = await this.validateInvitation(token);
    const updatedUses = (invite.uses || 0) + 1;
    const deactivationNeeded = updatedUses >= invite.max_uses;
    const { data, error } = await this.invites.supabase
      .from(this.invites.table)
      .update({ uses: updatedUses, active: deactivationNeeded ? false : invite.active })
      .eq('token', token)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

module.exports = InvitationService;
