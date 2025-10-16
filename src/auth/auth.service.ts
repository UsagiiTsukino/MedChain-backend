import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(@InjectRepository(User) private readonly usersRepo: Repository<User>) {}

  async register(dto: { walletAddress: string }) {
    let user = await this.usersRepo.findOne({ where: { walletAddress: dto.walletAddress } });
    if (!user) {
      user = this.usersRepo.create({ walletAddress: dto.walletAddress });
      await this.usersRepo.save(user);
    }
    return user;
  }

  async login(walletAddress: string) {
    const user = await this.usersRepo.findOne({ where: { walletAddress } });
    return user;
  }
}


