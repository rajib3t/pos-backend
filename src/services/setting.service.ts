import SettingRepository from '../repositories/setting.repository';
import { Connection } from 'mongoose';
import { ISetting } from '../models/setting.model';
import { IUser } from '../models/user.model';
class SettingService     {

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
            return this.settingRepository.create(data!);
        } else {
            // Using main database (backward compatibility)
            return this.settingRepository.create(connectionOrData);
        }
    }

    public async findSettingById(id: string): Promise<ISetting | null>;
    public async findSettingById(tenantConnection: Connection, id: string): Promise<ISetting | null>;
    public async findSettingById(connectionOrId: Connection | string, id?: string): Promise<ISetting | null> {
        if (connectionOrId instanceof Connection) {
            // Using tenant connection
            this.settingRepository = new SettingRepository(connectionOrId);
            return this.settingRepository.findById(id!);
        } else {
            // Using main database (backward compatibility)
            return this.settingRepository.findById(connectionOrId);
        }
    }

    public async findSettingTenantById(id: string): Promise<ISetting | null>;
    public async findSettingTenantById(tenantConnection: Connection, id: string): Promise<ISetting | null>;
    public async findSettingTenantById(connectionOrId: Connection | string, storeID?: string): Promise<ISetting | null> {
        if (connectionOrId instanceof Connection) {
            // Using tenant connection
            this.settingRepository = new SettingRepository(connectionOrId);
            return this.settingRepository.findByKey({store:storeID!});
        } else {
            // Using main database (backward compatibility)
        return this.settingRepository.findByKey({store: connectionOrId});
        }
    }

    public async updateSetting(id: string, data: Partial<ISetting>): Promise<ISetting | null>;
    public async updateSetting(tenantConnection: Connection, id: string, data: Partial<ISetting>): Promise<ISetting | null>;
    public async updateSetting(connectionOrId: Connection | string, idOrData: string | Partial<ISetting>, data?: Partial<ISetting>): Promise<ISetting | null> {
        if (connectionOrId instanceof Connection) {
            // Using tenant connection
            this.settingRepository = new SettingRepository(connectionOrId);
            return this.settingRepository.update(idOrData as string, data!);
        } else {
            // Using main database (backward compatibility)
            return this.settingRepository.update(connectionOrId, idOrData as Partial<ISetting>);
        }
    }

    


  
}

export default SettingService;