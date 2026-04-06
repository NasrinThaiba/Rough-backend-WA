import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AuthRequest } from '../types';

const signToken = (userId: string, phone: string) : string => {
    const secret = process.env.JWT_SECRET!;
    const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
    return jwt.sign({userId, phone},  secret, {expiresIn} as jwt.SignOptions)
};

export const register = async (req : Request, res:Response) : Promise<void> => {
    try {
        const { name, phone, email, password } = req.body;
        if(!name || !phone || !email || !password) {
            res.status(400).json({ success: false, message : "All inputs are required"})
            return;
        }

        const existingUser = await User.findOne({$or: [{ phone }, { email }]});
        if (existingUser) {res.status(400).json({success: false, message: "User already exists with this phone or email"});
        return;
      }

        const user = await User.create({ name, phone, email, password, avatar : ``})

        const token = signToken(user._id.toString(), user.phone);

        res.status(200).json({ success : true, token, user : {
            _id : user._id,
            name : user.name,
            phone : user.phone,
            email : user.email,
            avatar : user.avatar,
            status : user.status,
            isOnline : user.isOnline,
        },
      })
    } catch (error) {
        console.log('Register error :', error);
        res.status(500).json({success :  false, message : "Server error during registration!"})
    }
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      res.status(400).json({ success: false, message: 'Phone Number and Password are required.' });
      return;
    }

    const user = await User.findOne({ phone }).select('+password');
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id.toString(), user.phone);

    res.status(200).json({ success: true, token, user: {
       _id : user._id,
        name : user.name,
        phone : user.phone,
        email : user.email,
        avatar : user.avatar,
        status : user.status,
        isOnline : user.isOnline,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('getme error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    user.isOnline = false;
    user.lastSeen = new Date();

    await user.save({ validateBeforeSave: false });
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
    
  } catch (error) {
    console.error('logout error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
