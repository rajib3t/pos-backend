import SettingRepository from '../repositories/setting.repository';
import { Connection } from 'mongoose';
import { ISetting } from '../models/setting.model';
import { IUser } from '../models/user.model';
class SettingService {

    private static instance: SettingService;
    private settingRepository: SettingRepository;
    private constructor() {
        this.settingRepository = new SettingRepository();
    }

    public static getInstance(): SettingService {
        if (!SettingService.instance) {
            SettingService.instance = new SettingService();
        }
        return SettingService.instance;
    }

    // Original methods (for backward compatibility with main database)
    public async createSetting(data: Partial<ISetting>): Promise<ISetting>;
    public async createSetting(tenantConnection: Connection, data: Partial<ISetting>): Promise<ISetting>;
    public async createSetting(connectionOrData: Connection | Partial<ISetting>, data?: Partial<ISetting>): Promise<ISetting> {
        if (connectionOrData instanceof Connection) {
            // Using tenant connection
            this.settingRepository = new SettingRepository(connectionOrData);
            return this.settingRepository.createSetting(data!);
        } else {
            // Using main database (backward compatibility)
            return this.settingRepository.createSetting(connectionOrData);
        }
    }

    public async findSettingById(id: string): Promise<ISetting | null>;
    public async findSettingById(tenantConnection: Connection, id: string): Promise<ISetting | null>;
    public async findSettingById(connectionOrId: Connection | string, id?: string): Promise<ISetting | null> {
        if (connectionOrId instanceof Connection) {
            // Using tenant connection
            this.settingRepository = new SettingRepository(connectionOrId);
            return this.settingRepository.findSettingById(id!);
        } else {
            // Using main database (backward compatibility)
            return this.settingRepository.findSettingById(connectionOrId);
        }
    }

    public async findSettingTenantById(id: string): Promise<ISetting | null>;
    public async findSettingTenantById(tenantConnection: Connection, id: string): Promise<ISetting | null>;
    public async findSettingTenantById(connectionOrId: Connection | string, tenantId?: string): Promise<ISetting | null> {
        if (connectionOrId instanceof Connection) {
            // Using tenant connection
            this.settingRepository = new SettingRepository(connectionOrId);
            return this.settingRepository.findByKey({tenant:tenantId!});
        } else {
            // Using main database (backward compatibility)
        return this.settingRepository.findByKey({tenant: connectionOrId});
        }
    }

    public async updateSetting(id: string, data: Partial<ISetting>): Promise<ISetting | null>;
    public async updateSetting(tenantConnection: Connection, id: string, data: Partial<ISetting>): Promise<ISetting | null>;
    public async updateSetting(connectionOrId: Connection | string, idOrData: string | Partial<ISetting>, data?: Partial<ISetting>): Promise<ISetting | null> {
        if (connectionOrId instanceof Connection) {
            // Using tenant connection
            this.settingRepository = new SettingRepository(connectionOrId);
            return this.settingRepository.updateSetting(idOrData as string, data!);
        } else {
            // Using main database (backward compatibility)
            return this.settingRepository.updateSetting(connectionOrId, idOrData as Partial<ISetting>);
        }
    }

    public async deleteSetting(id: string): Promise<ISetting | null>;
    public async deleteSetting(tenantConnection: Connection, id: string): Promise<ISetting | null>;
    public async deleteSetting(connectionOrId: Connection | string, id?: string): Promise<ISetting | null> {
        if (connectionOrId instanceof Connection) {
            // Using tenant connection
            this.settingRepository = new SettingRepository(connectionOrId);
            return this.settingRepository.deleteSetting(id!);
        } else {
            // Using main database (backward compatibility)
            return this.settingRepository.deleteSetting(connectionOrId);
        }
    }

    public async findByKey(condition: { [key: string]: any }): Promise<ISetting | null>;
    public async findByKey(tenantConnection: Connection, condition: { [key: string]: any }): Promise<ISetting | null>;
    public async findByKey(connectionOrCondition: Connection | { [key: string]: any }, condition?: { [key: string]: any }): Promise<ISetting | null> {
        if (connectionOrCondition instanceof Connection) {
            // Using tenant connection
            this.settingRepository = new SettingRepository(connectionOrCondition);
            return this.settingRepository.findByKey(condition!);
        } else {
            // Using main database (backward compatibility)
            return this.settingRepository.findByKey(connectionOrCondition);
        }
    }


  
}

export default SettingService;