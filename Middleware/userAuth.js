import userSchema from "../Model/userModel.js"


export const checkSession = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/users/login");
  }
  next();
};

 export const islogin=(req,res,next)=>{
    if(req.session.user){
        res.redirect("/users/home")
    }else{
        next();
    }
}

export const noCache = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "-1");
  res.setHeader("Surrogate-Control", "no-store");
  next();
};

export const checkUserBlocked = async (req, res, next) => {
  try {
    if (!req.session.user) return next();

    const user = await userSchema.findById(req.session.user.id);

    if (!user || user.isBlocked) {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        return res.redirect("/users/login?message=blocked");
      });
      return;
    }

    next();
  } catch (error) {
    console.log("checkUserBlocked error:", error.message);
    next();
  }
};