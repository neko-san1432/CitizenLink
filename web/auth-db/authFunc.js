import { supabase } from "./db.js";

//Email register
export async function emailRegister(email, password){
    const {data,error} = await supabase.auth.signUp({
        email:email,
        password,password
    })
    if(error){
        console.error("Error registering user: ",error)
        return null;
    }
}

//Email login
export async function emailLogin(email, password){
    const {data, error} = await supabase.auth.signInWithPassword({
        email:email,
        password,password
    })
    if(error){
        console.error("Error loging in user: ",error)
        return null;
    }
}

//Reset password
export async function requestResetPassword(email){
    const {data,error} = await supabase.auth.resetPasswordForEmail(email,{
        redirectTo:""
    })
    if (error) {
    console.error('Error sending reset email:', error.message)
    return
  }
}