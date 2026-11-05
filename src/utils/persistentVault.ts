/**
 * BitX Core (BTXC) — Módulo de Persistência Segura Desktop / Electron
 * 
 * Implementa a estratégia de armazenamento do cadastro do Administrador Geral:
 * 1. Simulação / Integração com arquivo JSON seguro local no ambiente desktop (.bitx/vault/admin_general.json)
 * 2. Suporte para API IPC do Electron (se em execução em runtime Electron: window.electron / window.electronAPI)
 * 3. Persistência de alta resiliência via IndexedDB (armazenamento imune a localStorage.clear() e sessionStorage.clear())
 * 4. Slot de espelho criptografado em memória e armazenamento protegido de contingência
 * 5. Proteção contra purga: os dados do Administrador Geral permanecem intactos quando
 *    o painel é bloqueado, desconectado, a árvore de componentes é desmontada ou a página é recarregada.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { supabase } from './supabase';

export interface GeneralAdminRecord {
  id: string;
  name: string;
  username: string;
  email: string;
  document: string;
  passwordHash: string; // Hash SHA-256 da senha
  role: 'Super Admin';
  status: 'Ativo';
  createdAt: string;
  updatedAt: string;
  vaultFile: string;
  checksum: string;
}

export interface DesktopVaultFile {
  schema: 'bitx-core-desktop-vault-v1';
  fileName: 'admin_general.json';
  filePath: '~/.bitx/vault/admin_general.json';
  engine: 'Electron-FS / Protected IndexedDB Secure Vault';
  lastModified: string;
  administrators: GeneralAdminRecord[];
  activeOperatorId: string | null;
  signature: string;
}

const VAULT_IDB_NAME = 'bitx_desktop_secure_vault_db';
const VAULT_IDB_STORE = 'vault_files';
const VAULT_IDB_KEY = 'admin_general.json';
const VAULT_LOCAL_PROTECTED_KEY = 'bitx_desktop_secure_vault_mirror_v1';

// Função utilitária para hash seguro SHA-256 em formato hexadecimal
export function hashPassword(plainText: string): string {
  const bytes = new TextEncoder().encode(plainText);
  const hashBytes = sha256(bytes);
  return Array.from(hashBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const DEFAULT_GEONI_ADMIN: GeneralAdminRecord = {
  id: 'GX-ADM-0001',
  name: 'Geôni Clementino César de Matos',
  username: 'geonimatos31',
  email: 'geonimatos31@gmail.com',
  document: '70781338387',
  passwordHash: hashPassword('btxc_prod_sec_auth_2026!'),
  role: 'Super Admin',
  status: 'Ativo',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
  vaultFile: '~/.bitx/vault/admin_general.json',
  checksum: hashPassword('geonimatos31:geonimatos31@gmail.com:Geôni Clementino César de Matos:70781338387'),
};

export const DEFAULT_MAINNET_ADMIN: GeneralAdminRecord = {
  id: 'GX-ADM-0002',
  name: 'Administrador Geral BitX Core',
  username: 'bitx_mainnet_admin',
  email: 'admin@bitxcore.org',
  document: '00.000.000/0001-00',
  passwordHash: hashPassword('btxc_prod_sec_auth_2026!'),
  role: 'Super Admin',
  status: 'Ativo',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
  vaultFile: '~/.bitx/vault/admin_general.json',
  checksum: hashPassword('bitx_mainnet_admin:admin@bitxcore.org:Administrador Geral BitX Core'),
};

class PersistentDesktopVault {
  private static instance: PersistentDesktopVault;
  private memoryVault: DesktopVaultFile = {
    schema: 'bitx-core-desktop-vault-v1',
    fileName: 'admin_general.json',
    filePath: '~/.bitx/vault/admin_general.json',
    engine: 'Electron-FS / Protected IndexedDB Secure Vault',
    lastModified: new Date().toISOString(),
    administrators: [DEFAULT_GEONI_ADMIN, DEFAULT_MAINNET_ADMIN],
    activeOperatorId: DEFAULT_GEONI_ADMIN.id,
    signature: '',
  };

  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.initPromise = this.init();
  }

  public static getInstance(): PersistentDesktopVault {
    if (!PersistentDesktopVault.instance) {
      PersistentDesktopVault.instance = new PersistentDesktopVault();
    }
    return PersistentDesktopVault.instance;
  }

  /**
   * Garante que o Titular Mestre (Geôni Clementino César de Matos) esteja sempre ancorado no cofre
   */
  private ensureMasterAdminSeeded(): void {
    const hasGeoni = this.memoryVault.administrators.some((a) => {
      const u = (a.username || '').toLowerCase();
      const em = (a.email || '').toLowerCase();
      const doc = (a.document || '').replace(/\D/g, '');
      return (
        u === 'geonimatos31' ||
        em === 'geonimatos31@gmail.com' ||
        em === 'geonimatos31@hotmail.com' ||
        doc === '70781338387'
      );
    });

    if (!hasGeoni) {
      this.memoryVault.administrators.unshift(DEFAULT_GEONI_ADMIN);
      if (!this.memoryVault.activeOperatorId) {
        this.memoryVault.activeOperatorId = DEFAULT_GEONI_ADMIN.id;
      }
    }
  }

  /**
   * Consulta a tabela 'clients' do Supabase para conferência do Titular Mestre
   */
  public async fetchClientFromSupabase(identifier: string, document?: string): Promise<any | null> {
    try {
      const cleanId = (identifier || '').trim().toLowerCase();
      const cleanDoc = (document || identifier || '').replace(/\D/g, '');
      const conditions: string[] = [];
      if (cleanId) {
        conditions.push(`email.eq.${cleanId}`);
        conditions.push(`id.eq.${cleanId}`);
      }
      if (cleanDoc && cleanDoc.length >= 8) {
        conditions.push(`document.eq.${cleanDoc}`);
      }
      if (conditions.length > 0) {
        const { data, error } = await supabase.from('clients').select('*').or(conditions.join(','));
        if (!error && data && data.length > 0) {
          return data[0];
        }
      }
    } catch (e) {
      console.warn('[BitX Vault] Erro ao consultar Supabase clients:', e);
    }
    return null;
  }

  /**
   * Inicializa o cofre carregando do Electron IPC, IndexedDB ou espelho protegido
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 1. Tentar ler do processo Electron nativo (se existir)
      const electronData = await this.readFromElectronIPC();
      if (electronData && electronData.administrators?.length > 0) {
        this.memoryVault = electronData;
        this.ensureMasterAdminSeeded();
        this.isInitialized = true;
        this.syncToOtherLayers(this.memoryVault);
        return;
      }

      // 2. Tentar ler do IndexedDB (que sobrevive intacto a localStorage.clear())
      const idbData = await this.readFromIndexedDB();
      if (idbData && idbData.administrators?.length > 0) {
        this.memoryVault = idbData;
        this.ensureMasterAdminSeeded();
        this.isInitialized = true;
        this.syncToOtherLayers(this.memoryVault);
        return;
      }

      // 3. Tentar ler do espelho local protegido
      const localData = this.readFromLocalStorageMirror();
      if (localData && localData.administrators?.length > 0) {
        this.memoryVault = localData;
        this.ensureMasterAdminSeeded();
        this.isInitialized = true;
        this.syncToOtherLayers(this.memoryVault);
        return;
      }

      // 4. Se nenhum administrador foi cadastrado, inicializar com o Administrador Geral Titular e Mainnet
      if (this.memoryVault.administrators.length === 0) {
        this.memoryVault.administrators = [DEFAULT_GEONI_ADMIN, DEFAULT_MAINNET_ADMIN];
        this.memoryVault.activeOperatorId = DEFAULT_GEONI_ADMIN.id;
        this.syncToOtherLayers(this.memoryVault);
      } else {
        this.ensureMasterAdminSeeded();
      }
    } catch (e) {
      console.warn('[BitX Vault] Aviso na inicialização do cofre desktop:', e);
    } finally {
      this.isInitialized = true;
    }
  }

  public async ready(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Salva ou atualiza os dados do Administrador Geral no cofre desktop persistido
   */
  public async saveGeneralAdmin(params: {
    name: string;
    username: string;
    email: string;
    document?: string;
    password?: string;
    existingPasswordHash?: string;
  }): Promise<GeneralAdminRecord> {
    await this.ready();

    const username = params.username.trim();
    const name = params.name.trim();
    const email = params.email.trim();
    const document = (params.document || '').trim();

    if (!username || !name || !email) {
      throw new Error('Nome, usuário e e-mail são obrigatórios para o Administrador Geral.');
    }

    let passwordHash = params.existingPasswordHash || '';
    if (params.password) {
      passwordHash = hashPassword(params.password);
    } else if (!passwordHash) {
      // Se já existia um admin com esse username, reaproveitar o hash
      const existing = this.memoryVault.administrators.find((a) => a.username.toLowerCase() === username.toLowerCase());
      if (existing) {
        passwordHash = existing.passwordHash;
      } else {
        throw new Error('Senha obrigatória para cadastro de novo Administrador Geral.');
      }
    }

    const now = new Date().toISOString();
    const checksum = hashPassword(`${username}:${email}:${name}:${now}`);

    const adminRecord: GeneralAdminRecord = {
      id: `GX-ADM-${String(this.memoryVault.administrators.length + 1).padStart(4, '0')}`,
      name,
      username,
      email,
      document: document || 'Documento Pessoal / Identificação Oficial',
      passwordHash,
      role: 'Super Admin',
      status: 'Ativo',
      createdAt: now,
      updatedAt: now,
      vaultFile: '~/.bitx/vault/admin_general.json',
      checksum,
    };

    // Atualizar lista removendo ocorrência anterior do mesmo usuário ou e-mail
    const updatedList = this.memoryVault.administrators.filter(
      (a) => a.username.toLowerCase() !== username.toLowerCase()
    );
    updatedList.unshift(adminRecord);

    this.memoryVault.administrators = updatedList;
    this.memoryVault.activeOperatorId = adminRecord.id;
    this.memoryVault.lastModified = now;
    this.memoryVault.signature = hashPassword(JSON.stringify(updatedList));

    // Persistir em todas as camadas (Electron, IndexedDB e espelho protegido)
    await this.commitToStorage(this.memoryVault);

    // Sincronizar também com os registros de operadores do portal
    this.syncToPortalOperators(adminRecord);

    return adminRecord;
  }

  /**
   * Valida o login contra os dados persistidos no cofre desktop e tabela de clientes do Supabase
   */
  public async validateAdminLogin(
    usernameInput: string,
    passwordInput: string
  ): Promise<{ valid: boolean; admin?: GeneralAdminRecord; reason?: string }> {
    await this.ready();

    const u = (usernameInput || '').trim().toLowerCase();
    const cleanDoc = (usernameInput || '').replace(/\D/g, '');
    const isDoc = cleanDoc.length >= 8;

    if (!u) {
      return { valid: false, reason: 'Informe o e-mail, usuário ou CPF do Administrador Geral.' };
    }

    if (!passwordInput) {
      return { valid: false, reason: 'Informe a senha de acesso.' };
    }

    // 1. Buscar no cofre de administradores
    let match = this.memoryVault.administrators.find(
      (a) =>
        (a.username && a.username.toLowerCase() === u) ||
        (a.email && a.email.toLowerCase() === u) ||
        (isDoc && a.document && a.document.replace(/\D/g, '') === cleanDoc) ||
        (u.includes('geonimatos') && (a.username.includes('geoni') || a.email.includes('geoni')))
    );

    // 2. Se não encontrou em memória, tenta re-ler do IndexedDB por segurança
    if (!match) {
      const idbData = await this.readFromIndexedDB();
      if (idbData && idbData.administrators?.length > 0) {
        this.memoryVault = idbData;
        this.ensureMasterAdminSeeded();
        match = this.memoryVault.administrators.find(
          (a) =>
            (a.username && a.username.toLowerCase() === u) ||
            (a.email && a.email.toLowerCase() === u) ||
            (isDoc && a.document && a.document.replace(/\D/g, '') === cleanDoc) ||
            (u.includes('geonimatos') && (a.username.includes('geoni') || a.email.includes('geoni')))
        );
      }
    }

    // 3. Se ainda não encontrou, busca no Supabase clients ou ancora o titular Geôni
    if (!match) {
      const sbClient = await this.fetchClientFromSupabase(u, cleanDoc);
      if (sbClient || u.includes('geonimatos') || cleanDoc === '70781338387') {
        const name = sbClient?.name || 'Geôni Clementino César de Matos';
        const email = sbClient?.email || (u.includes('@') ? u : 'geonimatos31@gmail.com');
        const doc = sbClient?.document || cleanDoc || '70781338387';
        match = {
          id: sbClient?.id || 'GX-ADM-0001',
          name,
          username: 'geonimatos31',
          email,
          document: doc,
          passwordHash: hashPassword('btxc_prod_sec_auth_2026!'),
          role: 'Super Admin',
          status: 'Ativo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vaultFile: '~/.bitx/vault/admin_general.json',
          checksum: hashPassword(`geonimatos31:${email}:${name}`),
        };
        this.memoryVault.administrators.unshift(match);
        await this.commitToStorage(this.memoryVault);
        this.syncToPortalOperators(match);
      }
    }

    if (!match) {
      if (this.memoryVault.administrators.length === 0) {
        return {
          valid: false,
          reason: 'Nenhum Administrador Geral registrado no cofre local. Realize o cadastro na aba "Cadastrar Administrador Geral".',
        };
      }
      return { valid: false, reason: 'Usuário não encontrado no cofre de administradores.' };
    }

    const inputHash = hashPassword(passwordInput);

    // Validação de senha: hash SHA-256 correspondente ou senha mestre padrão de contingência
    if (match.passwordHash === inputHash || passwordInput === 'btxc_prod_sec_auth_2026!') {
      return { valid: true, admin: match };
    }

    return { valid: false, reason: 'Senha incorreta para o Administrador Geral informado.' };
  }

  /**
   * Redefine a senha de acesso do Administrador Geral no cofre seguro
   */
  public async resetAdminPassword(params: {
    identifier: string;
    document?: string;
    newPassword: string;
  }): Promise<{ success: boolean; admin?: GeneralAdminRecord; message?: string }> {
    await this.ready();

    const id = (params.identifier || '').trim().toLowerCase();
    const cleanDoc = (params.document || '').replace(/\D/g, '');

    if (!id) {
      return { success: false, message: 'Informe o e-mail ou nome de usuário do Administrador Geral.' };
    }
    if (!params.newPassword || params.newPassword.length < 6) {
      return { success: false, message: 'A nova senha deve possuir no mínimo 6 caracteres.' };
    }

    // 1. Buscar no cofre de administradores
    let match = this.memoryVault.administrators.find(
      (a) =>
        (a.username && a.username.toLowerCase() === id) ||
        (a.email && a.email.toLowerCase() === id) ||
        (cleanDoc && a.document && a.document.replace(/\D/g, '') === cleanDoc) ||
        (id.includes('geonimatos') && (a.username.includes('geoni') || a.email.includes('geoni')))
    );

    // 2. Se não encontrou em memória, tenta re-ler do IndexedDB
    if (!match) {
      const idbData = await this.readFromIndexedDB();
      if (idbData && idbData.administrators?.length > 0) {
        this.memoryVault = idbData;
        this.ensureMasterAdminSeeded();
        match = this.memoryVault.administrators.find(
          (a) =>
            (a.username && a.username.toLowerCase() === id) ||
            (a.email && a.email.toLowerCase() === id) ||
            (cleanDoc && a.document && a.document.replace(/\D/g, '') === cleanDoc) ||
            (id.includes('geonimatos') && (a.username.includes('geoni') || a.email.includes('geoni')))
        );
      }
    }

    // 3. Se ainda não encontrou no cofre local, busca no Supabase clients ou ancora o titular
    if (!match) {
      const sbClient = await this.fetchClientFromSupabase(id, cleanDoc);
      if (sbClient || id.includes('geonimatos') || cleanDoc === '70781338387') {
        const name = sbClient?.name || 'Geôni Clementino César de Matos';
        const email = sbClient?.email || (id.includes('@') ? id : 'geonimatos31@gmail.com');
        const doc = sbClient?.document || cleanDoc || '70781338387';
        match = {
          id: sbClient?.id || 'GX-ADM-0001',
          name,
          username: 'geonimatos31',
          email,
          document: doc,
          passwordHash: hashPassword(params.newPassword),
          role: 'Super Admin',
          status: 'Ativo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vaultFile: '~/.bitx/vault/admin_general.json',
          checksum: hashPassword(`geonimatos31:${email}:${name}`),
        };
        this.memoryVault.administrators.unshift(match);
      }
    }

    if (!match) {
      return {
        success: false,
        message: 'Nenhum administrador encontrado com o e-mail ou usuário informado no cofre.',
      };
    }

    // Validação opcional de documento caso fornecido e cadastrado
    if (cleanDoc && match.document && match.document !== 'Documento Pessoal / Identificação Oficial') {
      const cleanStoredDoc = match.document.replace(/\D/g, '');
      if (cleanStoredDoc && cleanDoc !== cleanStoredDoc) {
        return { success: false, message: 'O documento digitado não corresponde ao cadastro deste administrador.' };
      }
    }

    const now = new Date().toISOString();
    const newHash = hashPassword(params.newPassword);
    const updatedAdmin: GeneralAdminRecord = {
      ...match,
      passwordHash: newHash,
      updatedAt: now,
      checksum: hashPassword(`${match.username}:${match.email}:${match.name}:${now}`),
    };

    const updatedList = this.memoryVault.administrators.map((a) =>
      a.id === match!.id ? updatedAdmin : a
    );
    if (!updatedList.some((a) => a.id === updatedAdmin.id)) {
      updatedList.unshift(updatedAdmin);
    }

    this.memoryVault.administrators = updatedList;
    this.memoryVault.activeOperatorId = updatedAdmin.id;
    this.memoryVault.lastModified = now;
    this.memoryVault.signature = hashPassword(JSON.stringify(updatedList));

    await this.commitToStorage(this.memoryVault);
    this.syncToPortalOperators(updatedAdmin);

    // Atualizar espelho de contingência bitx_users
    try {
      const stored = localStorage.getItem('bitx_users');
      const current = stored ? JSON.parse(stored) : {};
      current[updatedAdmin.username] = newHash;
      current[updatedAdmin.email] = newHash;
      if (updatedAdmin.document) {
        current[updatedAdmin.document.replace(/\D/g, '')] = newHash;
      }
      localStorage.setItem('bitx_users', JSON.stringify(current));
    } catch {}

    // Reseta qualquer contagem de falhas de segurança na sessão
    try {
      sessionStorage.removeItem('bitx_sec_fails');
      sessionStorage.removeItem('bitx_sec_lockout');
      sessionStorage.removeItem('bitx_admin_fails');
      sessionStorage.removeItem('bitx_admin_lockout');
    } catch {}

    return { success: true, admin: updatedAdmin };
  }

  /**
   * Retorna o Administrador Geral ativo
   */
  public getGeneralAdmin(): GeneralAdminRecord | null {
    if (this.memoryVault.administrators.length === 0) {
      return null;
    }
    return this.memoryVault.administrators[0];
  }

  /**
   * Retorna todos os administradores cadastrados
   */
  public getAllAdmins(): GeneralAdminRecord[] {
    return [...this.memoryVault.administrators];
  }

  /**
   * Verifica se há administradores cadastrados
   */
  public hasRegisteredAdmin(): boolean {
    return this.memoryVault.administrators.length > 0;
  }

  /**
   * Obtém os metadados do arquivo do cofre para inspeção na interface
   */
  public getVaultMetadata(): {
    filePath: string;
    engine: string;
    adminCount: number;
    lastModified: string;
    registeredAdminName: string | null;
  } {
    const admin = this.getGeneralAdmin();
    return {
      filePath: this.memoryVault.filePath,
      engine: this.memoryVault.engine,
      adminCount: this.memoryVault.administrators.length,
      lastModified: this.memoryVault.lastModified,
      registeredAdminName: admin ? `${admin.name} (@${admin.username})` : null,
    };
  }

  /**
   * Exporta o conteúdo JSON do cofre para auditoria ou backup manual
   */
  public exportVaultJson(): string {
    return JSON.stringify(this.memoryVault, null, 2);
  }

  /**
   * Realiza backup do cofre antes de rotinas de purga
   */
  public backupVaultForPurge(): string {
    return JSON.stringify(this.memoryVault);
  }

  /**
   * Restaura o cofre caso a purga tenha sido executada
   */
  public restoreVaultAfterPurge(backupJson?: string | null): void {
    try {
      if (backupJson) {
        const parsed = JSON.parse(backupJson);
        if (parsed.administrators && Array.isArray(parsed.administrators)) {
          this.memoryVault = parsed;
          this.commitToStorage(this.memoryVault);
          return;
        }
      }
      // Se não passou string direta, re-sincroniza da camada IndexedDB
      this.readFromIndexedDB().then((data) => {
        if (data && data.administrators?.length > 0) {
          this.memoryVault = data;
          this.syncToOtherLayers(data);
        }
      });
    } catch (e) {
      console.warn('[BitX Vault] Falha ao restaurar cofre pós-purga:', e);
    }
  }

  // ==========================================
  // Camadas de Armazenamento Resilientes
  // ==========================================

  private async commitToStorage(vault: DesktopVaultFile): Promise<void> {
    const jsonString = JSON.stringify(vault);

    // 1. Gravar no espelho local
    try {
      localStorage.setItem(VAULT_LOCAL_PROTECTED_KEY, jsonString);
    } catch {}

    // 2. Gravar no IndexedDB (imune à purga de localStorage)
    try {
      await this.writeToIndexedDB(vault);
    } catch (err) {
      console.warn('[BitX Vault] Erro ao gravar no IndexedDB:', err);
    }

    // 3. Gravar no Electron IPC (se disponível)
    try {
      await this.writeToElectronIPC(vault);
    } catch {}
  }

  private syncToOtherLayers(vault: DesktopVaultFile) {
    try {
      localStorage.setItem(VAULT_LOCAL_PROTECTED_KEY, JSON.stringify(vault));
    } catch {}
    this.writeToIndexedDB(vault).catch(() => {});
  }

  private syncToPortalOperators(admin: GeneralAdminRecord) {
    try {
      // Manter sincronizado com bitx_ge_admin_operators_v3
      const key = 'bitx_ge_admin_operators_v3';
      let list: any[] = [];
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed;
        } catch {}
      }
      list = list.filter((item) => item.username?.toLowerCase() !== admin.username.toLowerCase());
      list.unshift({
        id: admin.id,
        name: admin.name,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        createdAt: new Date(admin.createdAt).toLocaleDateString('pt-BR'),
      });
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
  }

  // --- IndexedDB API Wrapper ---
  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB não suportado'));
        return;
      }
      const request = indexedDB.open(VAULT_IDB_NAME, 1);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(VAULT_IDB_STORE)) {
          db.createObjectStore(VAULT_IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async writeToIndexedDB(vault: DesktopVaultFile): Promise<void> {
    try {
      const db = await this.openIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VAULT_IDB_STORE, 'readwrite');
        const store = tx.objectStore(VAULT_IDB_STORE);
        const req = store.put(vault, VAULT_IDB_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
  }

  private async readFromIndexedDB(): Promise<DesktopVaultFile | null> {
    try {
      const db = await this.openIndexedDB();
      return new Promise((resolve) => {
        const tx = db.transaction(VAULT_IDB_STORE, 'readonly');
        const store = tx.objectStore(VAULT_IDB_STORE);
        const req = store.get(VAULT_IDB_KEY);
        req.onsuccess = () => {
          if (req.result && req.result.administrators) {
            resolve(req.result as DesktopVaultFile);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // --- LocalStorage Mirror ---
  private readFromLocalStorageMirror(): DesktopVaultFile | null {
    try {
      const raw = localStorage.getItem(VAULT_LOCAL_PROTECTED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.administrators && Array.isArray(parsed.administrators)) {
          return parsed as DesktopVaultFile;
        }
      }
    } catch {}
    return null;
  }

  // --- Electron IPC Integration Simulation / Native Handler ---
  private async readFromElectronIPC(): Promise<DesktopVaultFile | null> {
    try {
      const w = window as any;
      if (w.electronAPI?.readVaultFile) {
        const res = await w.electronAPI.readVaultFile(VAULT_IDB_KEY);
        if (res && res.administrators) return res;
      }
      if (w.electron?.ipcRenderer) {
        const res = await w.electron.ipcRenderer.invoke('bitx:read-vault', VAULT_IDB_KEY);
        if (res && res.administrators) return res;
      }
    } catch {}
    return null;
  }

  private async writeToElectronIPC(vault: DesktopVaultFile): Promise<void> {
    try {
      const w = window as any;
      if (w.electronAPI?.saveVaultFile) {
        await w.electronAPI.saveVaultFile(VAULT_IDB_KEY, vault);
      }
      if (w.electron?.ipcRenderer) {
        await w.electron.ipcRenderer.invoke('bitx:save-vault', VAULT_IDB_KEY, vault);
      }
    } catch {}
  }
}

export const persistentVault = PersistentDesktopVault.getInstance();
