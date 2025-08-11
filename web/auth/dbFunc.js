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
export async function emailLogin(){
    const {data, error} = await supabase.auth
}